"""Separate preparation and source-grounded review, with explicit unresolved gaps."""

import hashlib
import json
import time

from reading.serializers import VersionInput

from .provider import ReadingMLError, ReadingModelProvider
from .source import extract_pages, original_images

SCHEMA = """Candidate JSON shape: {book:string,test:positive integer,passage:1|2|3,content:{title:string,subtitle:string,instructions:string,paragraphs:[{label:string,text:string}],groups:[{title:string,instructions:string,kind:true_false|yes_no|short_answer|table|choice,questions:[{number:integer,prompt:string,max_words:integer,allow_number:boolean}],options:[string],headers:[string],rows:[[string]]}]},keys:{question_number:[accepted answer string]},source_pages:[PDF page integers],key_pages:[PDF page integers]}. Table rows must preserve every cell including rows without blanks; use {{number}} exactly once at each answer location. Use choice options with complete source option text, and keys matching those exact options. Preserve every paragraph, instruction, question, option and answer limit. Do not adapt away headings/matching/diagrams or silently omit them: report unsupported content as blocking findings. Never invent keys if the original answer-key page is missing."""
FINDINGS_SCHEMA = """Findings JSON: [{severity:error|warning,message:string,source_pages:[PDF page integers],path:string}]. Report errors for missing/uncertain source, omissions, unsupported visual assets/question kinds, missing keys, wrong order or corrupt layout. Do not declare errors resolved solely because a draft was edited; compare against the original images."""
INVENTORY_INSTRUCTION = (
    """Inventory every supplied PDF page for IELTS Reading preparation. Return JSON {pages:[{page:integer,kind:reading|questions|key|other|uncertain,book:string,test:integer|null,passage:integer|null,contains_visuals:boolean}],findings:[]}. Return every supplied page exactly once in source order. Distinguish Reading from Listening/Writing/Speaking; other means definitely unrelated/cover/contents/blank, never uncertain. Reading/questions require exact test and passage identities from source/neighbor context. A key page may have passage:null when it covers all three passages of its test. If identity is uncertain mark kind:uncertain; never guess. All numbers refer to physical PDF page indexes, not printed page labels. Identify maps/diagrams/required images as contains_visuals:true. The optional book hint does not override source evidence. """
    + FINDINGS_SCHEMA
)


def finding(
    message,
    pages=None,
    *,
    candidate=None,
    stage="validation",
    severity="error",
    path="",
):
    value = {
        "candidate_index": candidate,
        "stage": stage,
        "severity": severity,
        "message": str(message)[:1000],
        "source_pages": sorted(set(pages or [])),
        "path": str(path)[:200],
        "resolved": False,
    }
    value["id"] = hashlib.sha256(
        json.dumps(value, sort_keys=True).encode()
    ).hexdigest()[:24]
    return value


def _model_findings(raw, *, candidate=None, stage="review", allowed_pages=None):
    if not isinstance(raw, list) or len(raw) > 200:
        raise ReadingMLError(
            "invalid_model_findings", "Model review returned an invalid findings list."
        )
    result = []
    for item in raw:
        if not isinstance(item, dict) or not isinstance(item.get("message"), str):
            raise ReadingMLError(
                "invalid_model_findings", "Model review returned an incomplete finding."
            )
        pages = item.get("source_pages", [])
        if not isinstance(pages, list) or any(
            type(n) is not int or n not in (allowed_pages or []) for n in pages
        ):
            raise ReadingMLError(
                "invalid_page_evidence",
                "Model findings referenced invalid source-page evidence.",
            )
        result.append(
            finding(
                item["message"],
                pages,
                candidate=candidate,
                stage=stage,
                severity="warning" if item.get("severity") == "warning" else "error",
                path=item.get("path", ""),
            )
        )
    return result


def _validate_inventory(raw, batch):
    rows = raw.get("pages")
    expected = [p["page"] for p in batch]
    if (
        not isinstance(rows, list)
        or [r.get("page") if isinstance(r, dict) else None for r in rows] != expected
    ):
        raise ReadingMLError(
            "incomplete_page_inventory",
            "Model inventory did not account for every PDF page. Nothing was silently truncated.",
        )
    clean = []
    for row in rows:
        kind = row.get("kind")
        if kind not in {"reading", "questions", "key", "other", "uncertain"}:
            raise ReadingMLError(
                "invalid_page_inventory",
                "Model inventory contains an unsupported page category.",
            )
        test, passage = row.get("test"), row.get("passage")
        if kind in {"reading", "questions", "key"} and (
            type(test) is not int or not 1 <= test <= 100
        ):
            kind = "uncertain"
        if kind in {"reading", "questions"} and (
            type(passage) is not int or not 1 <= passage <= 3
        ):
            kind = "uncertain"
        if (
            kind == "key"
            and passage is not None
            and (type(passage) is not int or not 1 <= passage <= 3)
        ):
            kind = "uncertain"
        clean.append(
            {
                "page": row["page"],
                "kind": kind,
                "book": str(row.get("book") or "")[:150],
                "test": test,
                "passage": passage,
                "contains_visuals": row.get("contains_visuals") is True,
            }
        )
    return clean


def _candidate_checks(candidate, job, index, total_pages):
    errors = []
    if not isinstance(candidate, dict):
        return [finding("Model did not return a structured passage.", candidate=index)]
    payload = {
        **candidate,
        "source_name": job.source_name,
        "license": job.license,
        "rights_confirmed": job.rights_confirmed,
        "review_notes": "Independent model review; human approval remains required.",
    }
    validator = VersionInput(data=payload)
    if not validator.is_valid():
        errors.append(
            finding(
                "Passage/questions/keys do not satisfy the required structure. Correct the highlighted draft and its answer keys before publication.",
                candidate=index,
                path="content",
            )
        )
    if (
        type(candidate.get("test")) is not int
        or not 1 <= candidate.get("test", 0) <= 100
        or type(candidate.get("passage")) is not int
        or not 1 <= candidate.get("passage", 0) <= 3
        or not isinstance(candidate.get("book"), str)
        or not candidate.get("book", "").strip()
    ):
        errors.append(
            finding(
                "Confirm the source book, test and passage identity.",
                candidate=index,
                path="book",
            )
        )
    for key in ["source_pages", "key_pages"]:
        refs = candidate.get(key, [])
        if (
            not isinstance(refs, list)
            or not refs
            or any(type(n) is not int or not 1 <= n <= total_pages for n in refs)
        ):
            errors.append(
                finding(
                    "Missing or invalid original page references.",
                    candidate=index,
                    path=key,
                )
            )
    return errors


def run_pipeline(job, progress=None, provider=None):
    """Return drafts/review evidence only. This function never publishes content."""
    started = time.monotonic()
    provider = provider or ReadingModelProvider()
    pages, source_issues = extract_pages(job.source, progress)
    page_numbers = [p["page"] for p in pages]
    findings = [
        finding(x["message"], x["source_pages"], stage="extract") for x in source_issues
    ]
    inventory = []
    # Every physical page participates; bounded batches prevent context truncation.
    for offset in range(0, len(pages), 6):
        batch = pages[offset : offset + 6]
        if progress:
            progress(
                "inventorying_pages", {"pages_done": offset, "pages_total": len(pages)}
            )
        images = original_images(job.source, [p["page"] for p in batch])
        raw = provider.complete(
            INVENTORY_INSTRUCTION,
            {"book_hint": job.book, "pages": batch, "previous_pages": inventory[-4:]},
            images=images,
        )
        rows = _validate_inventory(raw, batch)
        findings.extend(
            _model_findings(
                raw.get("findings", []),
                stage="extract",
                allowed_pages=[p["page"] for p in batch],
            )
        )
        inventory.extend(rows)
    groups = {}
    for row in inventory:
        if row["kind"] == "uncertain":
            findings.append(
                finding(
                    "The page could not be safely assigned to a Reading passage or excluded. Review the original source; automatic import coverage is incomplete.",
                    [row["page"]],
                    stage="extract",
                )
            )
        if row["kind"] in {"reading", "questions"}:
            identity = (row["test"], row["passage"])
            group = groups.setdefault(
                identity,
                {"book": job.book or row["book"], "source_pages": [], "key_pages": []},
            )
            group["source_pages"].append(row["page"])
    for (test, passage), group in groups.items():
        group["key_pages"] = [
            r["page"]
            for r in inventory
            if r["kind"] == "key"
            and r["test"] == test
            and r["passage"] in (None, passage)
        ]
    if not groups:
        findings.append(
            finding(
                "No complete Reading passage could be identified. Review the source or provide a clearer PDF.",
                page_numbers,
                stage="extract",
            )
        )
    if len(groups) > 60:
        raise ReadingMLError(
            "passage_count_limit",
            "The PDF contains more than 60 detected passages. Split the source book.",
        )
    candidates = []
    review_count = 0
    for index, ((test, passage), group) in enumerate(sorted(groups.items())):
        refs = sorted(set(group["source_pages"] + group["key_pages"]))
        if progress:
            progress(
                "preparing_passages",
                {
                    "passages_done": index,
                    "passages_total": len(groups),
                    "test": test,
                    "passage": passage,
                },
            )
        evidence = [p for p in pages if p["page"] in refs]
        if len(refs) > 12:
            findings.append(
                finding(
                    "Detected passage spans more than 12 source/key pages. Check its boundaries before importing it.",
                    refs,
                    candidate=index,
                    stage="extract",
                )
            )
            candidates.append(
                {
                    "book": group["book"],
                    "test": test,
                    "passage": passage,
                    "source_pages": group["source_pages"],
                    "key_pages": group["key_pages"],
                    "content": {},
                    "keys": {},
                }
            )
            continue
        images = original_images(job.source, refs)
        identity = {
            "book": group["book"],
            "test": test,
            "passage": passage,
            "source_pages": group["source_pages"],
            "key_pages": group["key_pages"],
        }
        raw = provider.complete(
            "Prepare exactly this Reading passage from original evidence. Return JSON {candidate:Candidate,findings:[]}. "
            + SCHEMA
            + FINDINGS_SCHEMA,
            {"identity": identity, "pages": evidence},
            images=images,
        )
        candidate = raw.get("candidate")
        if not isinstance(candidate, dict):
            raise ReadingMLError(
                "invalid_model_candidate",
                "The model did not return a structured passage draft.",
            )
        candidate.update(identity)
        preparation_issues = _model_findings(
            raw.get("findings", []),
            candidate=index,
            stage="extract",
            allowed_pages=refs,
        )
        review_instruction = (
            "Independently compare this prepared Reading candidate against the ORIGINAL PDF PAGE IMAGES, using OCR only as a fallible aid. Check every paragraph, title, instruction, question, option, table cell, required image, key and word limit; identify unsupported or omitted content. Do not trust the preparer's claims. Return JSON {findings:[],checked_source_pages:[all provided page numbers],complete:true|false}. complete means this review covered all provided source/key evidence, not that the candidate is correct. "
            + FINDINGS_SCHEMA
        )
        if progress:
            progress(
                "independent_review",
                {"passages_done": index, "passages_total": len(groups)},
            )
        review = provider.complete(
            review_instruction,
            {"candidate": candidate, "pages": evidence},
            review=True,
            images=images,
        )
        review_count += 1
        if (
            review.get("complete") is not True
            or sorted(review.get("checked_source_pages", [])) != refs
        ):
            findings.append(
                finding(
                    "Independent review did not cover all source/key pages for this passage.",
                    refs,
                    candidate=index,
                    stage="review",
                )
            )
        review_issues = _model_findings(
            review.get("findings", []), candidate=index, allowed_pages=refs
        )
        if review_issues:
            if progress:
                progress(
                    "correcting_draft",
                    {"passages_done": index, "passages_total": len(groups)},
                )
            corrected = provider.complete(
                "Correct this candidate only where the original source evidence supports a correction. Never invent absent content. Return JSON {candidate:Candidate,findings:[]}. "
                + SCHEMA
                + FINDINGS_SCHEMA,
                {"candidate": candidate, "findings": review_issues, "pages": evidence},
                images=images,
            )
            replacement = corrected.get("candidate")
            if not isinstance(replacement, dict):
                raise ReadingMLError(
                    "invalid_model_candidate",
                    "The model correction did not return a structured passage.",
                )
            replacement.update(identity)
            candidate = replacement
            preparation_issues.extend(
                _model_findings(
                    corrected.get("findings", []),
                    candidate=index,
                    stage="extract",
                    allowed_pages=refs,
                )
            )
            recheck = provider.complete(
                review_instruction,
                {
                    "candidate": candidate,
                    "pages": evidence,
                    "prior_findings": review_issues,
                },
                review=True,
                images=images,
            )
            review_count += 1
            # Keep review history in metrics, while the latest source-grounded recheck decides outstanding issues.
            if (
                recheck.get("complete") is True
                and sorted(recheck.get("checked_source_pages", [])) == refs
            ):
                review_issues = _model_findings(
                    recheck.get("findings", []), candidate=index, allowed_pages=refs
                )
            else:
                review_issues.append(
                    finding(
                        "The independent correction recheck did not cover all source pages.",
                        refs,
                        candidate=index,
                        stage="review",
                    )
                )
        if any(
            r["contains_visuals"]
            for r in inventory
            if r["page"] in group["source_pages"]
        ):
            findings.append(
                finding(
                    "Source contains a required image/diagram. This native Reading format does not yet support verified visual-asset placement; compare and complete it before publication.",
                    group["source_pages"],
                    candidate=index,
                    stage="validation",
                    path="content",
                )
            )
        findings.extend(
            preparation_issues
            + review_issues
            + _candidate_checks(candidate, job, index, len(pages))
        )
        candidates.append(candidate)
    # Independent whole-book coverage review catches Reading pages misclassified as unrelated.
    for offset in range(0, len(pages), 6):
        batch = pages[offset : offset + 6]
        refs = [p["page"] for p in batch]
        if progress:
            progress(
                "checking_coverage", {"pages_done": offset, "pages_total": len(pages)}
            )
        result = provider.complete(
            "Independently audit Reading import COVERAGE for each original page. Check whether a Reading passage/question/key page was excluded, assigned to the wrong test/passage or omitted from candidates. Do not check Listening/Writing content as Reading. Return JSON {findings:[],checked_source_pages:[every provided page number],complete:true|false}. "
            + FINDINGS_SCHEMA,
            {
                "pages": batch,
                "inventory": [r for r in inventory if r["page"] in refs],
                "candidate_coverage": [
                    {
                        "candidate_index": i,
                        "book": c.get("book"),
                        "test": c.get("test"),
                        "passage": c.get("passage"),
                        "source_pages": c.get("source_pages"),
                        "key_pages": c.get("key_pages"),
                    }
                    for i, c in enumerate(candidates)
                ],
            },
            review=True,
            images=original_images(job.source, refs),
        )
        review_count += 1
        if (
            result.get("complete") is not True
            or sorted(result.get("checked_source_pages", [])) != refs
        ):
            findings.append(
                finding(
                    "Independent full-document coverage review was incomplete for these pages.",
                    refs,
                    stage="review",
                )
            )
        findings.extend(_model_findings(result.get("findings", []), allowed_pages=refs))
    findings = list({f["id"]: f for f in findings}.values())
    calls = getattr(provider, "calls", [])
    metrics = {
        "source_pages": len(pages),
        "text_pages": sum(p["method"] == "text" for p in pages),
        "ocr_pages": sum(p["method"] == "ocr" for p in pages),
        "detected_passages": len(candidates),
        "model_calls": len(calls),
        "independent_review_calls": review_count,
        "independent_review_completed": bool(review_count and candidates),
        "preparation_model": provider.model,
        "review_model": provider.review_model,
        "elapsed_seconds": round(time.monotonic() - started, 2),
        "unresolved_findings": len(findings),
        "page_inventory": inventory,
    }
    return {"candidates": candidates, "findings": findings, "metrics": metrics}


def run_ocr_pipeline(job, progress=None):
    """Current default: real extraction/OCR only, followed by complete human review.

    No model endpoint is contacted and no passage, question or answer key is guessed.
    The optional model-assisted pipeline above is intentionally not invoked.
    """
    started = time.monotonic()
    pages, source_issues = extract_pages(job.source, progress)
    findings = [
        finding(x["message"], x["source_pages"], stage="extract") for x in source_issues
    ]
    extracted_pages = []
    for page in pages:
        extracted_pages.append(
            {
                **page,
                "warnings": [
                    issue["message"]
                    for issue in source_issues
                    if page["page"] in issue["source_pages"]
                ],
            }
        )
    return {
        "extracted_pages": extracted_pages,
        "candidates": [],
        "findings": findings,
        "metrics": {
            "processing_mode": "ocr_only",
            "source_pages": len(pages),
            "text_pages": sum(p["method"] == "text" for p in pages),
            "ocr_pages": sum(p["method"] == "ocr" for p in pages),
            "model_calls": 0,
            "independent_review_calls": 0,
            "independent_review_completed": False,
            "human_source_review_required": True,
            "elapsed_seconds": round(time.monotonic() - started, 2),
            "unresolved_findings": len(findings),
        },
    }
