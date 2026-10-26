from rest_framework import serializers

from .answer_groups import answer_groups
from .html_paper import MARKER, sanitize
from .models import Question, QuestionDocument


class OptionInput(serializers.Serializer):
    key = serializers.RegexField(r"^[A-Za-z0-9]{1,8}$")
    text = serializers.CharField(max_length=1000)


class QuestionInput(serializers.Serializer):
    number = serializers.IntegerField(min_value=1, max_value=100)
    part = serializers.IntegerField(min_value=1, max_value=4, default=1)
    type = serializers.ChoiceField(choices=Question.Kind.choices)
    prompt = serializers.CharField(max_length=5000)
    instructions = serializers.CharField(
        max_length=500, required=False, allow_blank=True, default=""
    )
    options = OptionInput(many=True, required=False, default=list)
    answers = serializers.ListField(
        child=serializers.JSONField(), min_length=1, max_length=20
    )
    max_words = serializers.IntegerField(min_value=1, max_value=20, default=3)
    context = serializers.JSONField(required=False, default=dict)

    def validate(self, data):
        if not isinstance(data["context"], dict) or len(str(data["context"])) > 20000:
            raise serializers.ValidationError(
                {"context": "Use a small context object."}
            )
        if "body" in data["context"] and not isinstance(data["context"]["body"], str):
            raise serializers.ValidationError(
                {"context": "Student context must be plain text."}
            )
        keys = [str(option["key"]).upper() for option in data["options"]]
        if len(keys) != len(set(keys)) or len(keys) > 20:
            raise serializers.ValidationError(
                {"options": "Use at most 20 uniquely labelled options."}
            )
        for option in data["options"]:
            option["key"] = str(option["key"]).upper()
        choice = data["type"] in ("multiple_choice", "matching")
        if choice and len(keys) < 2:
            raise serializers.ValidationError(
                {"options": "Choice and matching questions need at least two options."}
            )
        for answer in data["answers"]:
            if isinstance(answer, str):
                if not answer.strip() or len(answer) > 300:
                    raise serializers.ValidationError(
                        {"answers": "Use nonempty answers of up to 300 characters."}
                    )
                if choice and answer.upper() not in keys:
                    raise serializers.ValidationError(
                        {
                            "answers": "Correct answers must reference an existing option key."
                        }
                    )
                if not choice and len(answer.split()) > data["max_words"]:
                    raise serializers.ValidationError(
                        {"max_words": "An accepted answer exceeds the word limit."}
                    )
            elif isinstance(answer, list) and data["type"] == "multiple_choice":
                if (
                    not answer
                    or len(answer) > 10
                    or any(
                        not isinstance(a, str) or a.upper() not in keys for a in answer
                    )
                    or len(set(map(str.upper, answer))) != len(answer)
                ):
                    raise serializers.ValidationError(
                        {
                            "answers": "Multiple selections must contain unique existing option keys."
                        }
                    )
            else:
                raise serializers.ValidationError(
                    {
                        "answers": "Use text answers, or an array of selected keys for multiple choice."
                    }
                )
        selections = [len(a) if isinstance(a, list) else 1 for a in data["answers"]]
        if choice and len(set(selections)) > 1:
            raise serializers.ValidationError(
                {
                    "answers": "All accepted combinations must require the same number of choices."
                }
            )
        return data


class PaperSectionInput(serializers.Serializer):
    part = serializers.IntegerField(min_value=1, max_value=4)
    html = serializers.CharField(max_length=100_000)


class QuestionSetInput(serializers.Serializer):
    presentation = serializers.ChoiceField(
        choices=["text", "html", "pdf", "legacy_pdf"], default="text"
    )
    sections = PaperSectionInput(many=True, required=False, default=list, max_length=20)
    questions = QuestionInput(many=True, allow_empty=False, max_length=100)
    document = serializers.IntegerField(required=False, allow_null=True)
    document_pages = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=50),
        required=False,
        default=list,
    )
    duration_seconds = serializers.IntegerField(
        min_value=60, max_value=14400, default=1800
    )

    def validate(self, data):
        if data["presentation"] == "html":
            if (
                not data["sections"]
                or sum(len(s["html"]) for s in data["sections"]) > 100_000
            ):
                raise serializers.ValidationError(
                    {
                        "sections": "Provide a question paper of up to 100,000 characters."
                    }
                )
            by_number = {q["number"]: q for q in data["questions"]}
            placed = {}
            for section in data["sections"]:
                section["html"] = sanitize(section["html"])
                for match in MARKER.finditer(section["html"]):
                    n, key = int(match[1]), match[2]
                    if (
                        n not in by_number
                        or by_number[n]["part"] != section["part"]
                        or (
                            key
                            and key not in [o["key"] for o in by_number[n]["options"]]
                        )
                    ):
                        raise serializers.ValidationError(
                            {
                                "sections": f"Marker {match[0]} does not match a question/option in Part {section['part']}."
                            }
                        )
                    placed.setdefault(n, []).append(key)
            if set(placed) != set(by_number):
                raise serializers.ValidationError(
                    {
                        "sections": "Place every question in the formatted paper using {{1}}, {{2}} or option markers {{3:A}}."
                    }
                )
            for n, markers in placed.items():
                if len(markers) != len(set(markers)) or (
                    None in markers and len(markers) != 1
                ):
                    raise serializers.ValidationError(
                        {"sections": f"Question {n} has duplicate answer fields."}
                    )
                if None not in markers and set(markers) != {
                    o["key"] for o in by_number[n]["options"]
                }:
                    raise serializers.ValidationError(
                        {
                            "sections": f"Question {n}: include a control for every option."
                        }
                    )
        if data["presentation"] == "pdf" and (
            not data.get("document") or not data["document_pages"]
        ):
            raise serializers.ValidationError(
                {
                    "document_pages": "Choose the PDF question pages for the original-layout exam."
                }
            )
        for q in data["questions"]:
            if data["presentation"] == "pdf":
                field = q["context"].get("pdf_field")
                if (
                    not isinstance(field, dict)
                    or field.get("page") not in data["document_pages"]
                ):
                    raise serializers.ValidationError(
                        {
                            "questions": f"Question {q['number']}: place its answer field on a selected PDF page."
                        }
                    )
                for name in ("x", "y", "width", "height"):
                    value = field.get(name)
                    if (
                        isinstance(value, bool)
                        or not isinstance(value, (int, float))
                        or not 0 <= value <= 1
                    ):
                        raise serializers.ValidationError(
                            {
                                "questions": f"Question {q['number']}: invalid answer field dimensions."
                            }
                        )
                if (
                    field["width"] <= 0
                    or field["height"] <= 0
                    or field["x"] + field["width"] > 1.00001
                    or field["y"] + field["height"] > 1.00001
                ):
                    raise serializers.ValidationError(
                        {
                            "questions": f"Question {q['number']}: keep the whole answer field inside its PDF page."
                        }
                    )
        if (
            any(q["type"] in ("map_label", "diagram_label") for q in data["questions"])
            and not data.get("document")
            and data["presentation"] == "legacy_pdf"
        ):
            raise serializers.ValidationError(
                {
                    "document": "Upload a PDF containing the map or diagram and select its question pages."
                }
            )
        for q in data["questions"]:
            if data["presentation"] == "text":
                if "answer using the question paper" in q["prompt"].lower():
                    raise serializers.ValidationError(
                        {
                            "questions": f"Question {q['number']}: replace the PDF placeholder with the actual question text."
                        }
                    )
                if (
                    q["type"] in ("map_label", "diagram_label")
                    and not str(q["context"].get("body", "")).strip()
                ):
                    raise serializers.ValidationError(
                        {
                            "questions": f"Question {q['number']}: provide a complete text description; images are not shown in Mock."
                        }
                    )
            table = q["context"].get("table")
            if table is not None and (
                not isinstance(table, list)
                or len(table) > 50
                or any(
                    not isinstance(row, list)
                    or len(row) > 15
                    or any(
                        not isinstance(cell, str) or len(cell) > 1000 for cell in row
                    )
                    for row in table
                )
            ):
                raise serializers.ValidationError(
                    {
                        "context": "Use a table with at most 50 rows and 15 text cells per row."
                    }
                )
            if (
                q["type"] == "table_completion"
                and not table
                and (
                    data["presentation"] == "text"
                    or (
                        data["presentation"] == "legacy_pdf"
                        and not data.get("document")
                    )
                )
            ):
                raise serializers.ValidationError(
                    {"context": "Provide the completion table as text rows and cells."}
                )
        answer_groups(data["questions"])
        return data

    def validate_questions(self, value):
        numbers = [q["number"] for q in value]
        if len(numbers) != len(set(numbers)):
            raise serializers.ValidationError("Question numbers must be unique.")
        part = self.context.get("assigned_part")
        allowed_starts = {1, (part - 1) * 10 + 1} if part else {1}
        if not any(
            sorted(numbers) == list(range(start, start + len(numbers)))
            for start in allowed_starts
        ):
            raise serializers.ValidationError(
                "Use consecutive numbers starting at 1 or at this Part's IELTS question number."
            )
        return value


class QuestionDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionDocument
        fields = [
            "id",
            "page_count",
            "extraction_state",
            "extracted_text",
            "created_at",
        ]


class QuestionDraftInput(serializers.Serializer):
    document = serializers.IntegerField()
    pages = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=50),
        allow_empty=False,
        max_length=50,
    )
