"""Bounded, resumable private source inventory; produces evidence, never content approval.

Each invocation renders/OCRs at most --batch-size missing headers. Existing
successful text is reused. No network, database, publication or source mutation.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

import pypdfium2 as pdfium


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--volume", type=int)
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 100:
        parser.error("batch-size must be 1–100")
    args.output.mkdir(parents=True, exist_ok=True, mode=0o700)
    rows = json.loads(args.manifest.read_text())
    remaining = args.batch_size
    inventory = []
    for row in rows:
        volume = row["volume"]
        if args.volume is not None and volume != args.volume:
            continue
        source = Path(row["path"])
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if digest != row["sha256"]:
            raise ValueError(f"Source hash changed for volume {volume}")
        folder = args.output / f"volume-{volume}"
        folder.mkdir(exist_ok=True, mode=0o700)
        completed = []
        matches = []
        with pdfium.PdfDocument(str(source)) as pdf:
            for index in range(len(pdf)):
                target = folder / f"{index + 1:03}.json"
                if target.exists():
                    evidence = json.loads(target.read_text())
                    if evidence["source_sha256"] != digest:
                        raise ValueError(f"Stale evidence: {target}")
                elif remaining:
                    page = pdf[index]
                    textpage = page.get_textpage()
                    text = textpage.get_text_range()
                    textpage.close()
                    method = "pdf-text"
                    # OCR only the top 40%; release each bitmap before the next page.
                    if len(text.strip()) < 30:
                        _width, height = page.get_size()
                        bitmap = page.render(scale=1.45, crop=(0, height * 0.60, 0, 0))
                        image = folder / f"{index + 1:03}.png"
                        bitmap.to_pil().save(image)
                        bitmap.close()
                        try:
                            result = subprocess.run(
                                [
                                    "tesseract",
                                    str(image),
                                    "stdout",
                                    "--psm",
                                    "6",
                                    "-l",
                                    "eng",
                                ],
                                capture_output=True,
                                text=True,
                                check=True,
                                timeout=60,
                                env=dict(os.environ, OMP_THREAD_LIMIT="1"),
                            )
                            text = result.stdout
                        finally:
                            image.unlink(missing_ok=True)
                        method = "header-ocr"
                    page.close()
                    evidence = {
                        "page": index + 1,
                        "method": method,
                        "text": text,
                        "source_sha256": digest,
                    }
                    temporary = target.with_suffix(".tmp")
                    temporary.write_text(
                        json.dumps(evidence, ensure_ascii=False, indent=2)
                    )
                    temporary.replace(target)
                    remaining -= 1
                else:
                    continue
                completed.append(index + 1)
                if re.search(
                    r"READING\s*(?:PASSAGE)?|Answer\s*keys?",
                    evidence["text"],
                    re.IGNORECASE,
                ):
                    matches.append({"page": index + 1, "method": evidence["method"]})
            inventory.append(
                {
                    "volume": volume,
                    "source_sha256": digest,
                    "pages": len(pdf),
                    "inventoried": completed,
                    "heading_candidates": matches,
                    "review_status": "Unreviewed page candidates; source comparison required",
                }
            )
    report = args.output / (
        "inventory.json" if args.volume is None else f"inventory-{args.volume}.json"
    )
    temporary = report.with_suffix(".tmp")
    temporary.write_text(json.dumps(inventory, indent=2))
    temporary.replace(report)
    print(
        json.dumps(
            {
                "processed": args.batch_size - remaining,
                "report": str(report),
                "volumes": [
                    {
                        "volume": r["volume"],
                        "pages": r["pages"],
                        "inventoried": len(r["inventoried"]),
                    }
                    for r in inventory
                ],
            }
        )
    )


if __name__ == "__main__":
    main()
