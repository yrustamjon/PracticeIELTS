from rest_framework import serializers

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


class QuestionSetInput(serializers.Serializer):
    presentation = serializers.ChoiceField(
        choices=["text", "legacy_pdf"], default="text"
    )
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
                and (data["presentation"] == "text" or not data.get("document"))
            ):
                raise serializers.ValidationError(
                    {"context": "Provide the completion table as text rows and cells."}
                )
        return data

    def validate_questions(self, value):
        numbers = [q["number"] for q in value]
        if len(numbers) != len(set(numbers)):
            raise serializers.ValidationError("Question numbers must be unique.")
        if sorted(numbers) != list(range(1, len(numbers) + 1)):
            raise serializers.ValidationError(
                "Use consecutive question numbers beginning at 1."
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
