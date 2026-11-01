import math
import re

from rest_framework import serializers

from exams.services import normalize


class ParagraphInput(serializers.Serializer):
    label = serializers.CharField(max_length=12, allow_blank=True, default="")
    text = serializers.CharField(max_length=15000)


class QuestionInput(serializers.Serializer):
    number = serializers.IntegerField(min_value=1, max_value=40)
    prompt = serializers.CharField(max_length=3000, allow_blank=True, default="")
    max_words = serializers.IntegerField(min_value=1, max_value=10, default=1)
    allow_number = serializers.BooleanField(default=False)


class GroupInput(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    instructions = serializers.CharField(max_length=3000)
    kind = serializers.ChoiceField(
        choices=[
            "true_false",
            "yes_no",
            "short_answer",
            "table",
            "choice",
            "multiple_choice",
            "headings",
            "matching",
            "completion",
        ]
    )
    text = serializers.CharField(max_length=20000, allow_blank=True, default="")
    questions = QuestionInput(many=True, allow_empty=False)
    options = serializers.ListField(
        child=serializers.CharField(max_length=1000), max_length=30, default=list
    )
    option_labels = serializers.DictField(
        child=serializers.CharField(max_length=1000), default=dict
    )
    figure_indices = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=9),
        max_length=10,
        default=list,
    )
    unordered_sets = serializers.ListField(
        child=serializers.ListField(
            child=serializers.IntegerField(min_value=1, max_value=40),
            min_length=2, max_length=10,
        ),
        max_length=10, default=list,
    )
    headers = serializers.ListField(
        child=serializers.CharField(max_length=200, allow_blank=True),
        max_length=10,
        default=list,
    )
    rows = serializers.ListField(
        child=serializers.ListField(
            child=serializers.CharField(max_length=3000, allow_blank=True),
            max_length=10,
        ),
        max_length=50,
        default=list,
    )

    def validate(self, data):
        if len(data["questions"]) > 40:
            raise serializers.ValidationError("At most 40 questions per group.")
        if data["unordered_sets"]:
            slots = [n for pool in data["unordered_sets"] for n in pool]
            if (
                data["kind"] not in {"short_answer", "completion", "table"}
                or data["options"]
                or len(slots) != len(set(slots))
                or set(slots) - {q["number"] for q in data["questions"]}
            ):
                raise serializers.ValidationError(
                    "Unordered text sets must reference distinct slots in the same free-text group."
                )
        if data["kind"] == "completion":
            markers = [int(n) for n in re.findall(r"\{\{(\d+)\}\}", data["text"])]
            if sorted(markers) != sorted(q["number"] for q in data["questions"]):
                raise serializers.ValidationError(
                    "Completion text must contain every question marker exactly once."
                )
        if data["kind"] in {"choice", "multiple_choice", "headings", "matching"} or (
            data["kind"] == "completion" and data["options"]
        ):
            options = data["options"]
            if not options or len(set(options)) != len(options):
                raise serializers.ValidationError("Provide unique source options.")
            labels = data["option_labels"]
            if set(labels) - set(options):
                raise serializers.ValidationError(
                    "Option labels must belong to the source options."
                )
            if data["kind"] == "headings" and set(labels) != set(options):
                raise serializers.ValidationError(
                    "Provide the complete text of every heading."
                )
        elif data["option_labels"]:
            raise serializers.ValidationError(
                "Option labels require a choice, headings or matching group."
            )
        if data["kind"] == "multiple_choice":
            if (
                not 2 <= len(data["questions"]) <= 10
                or len(data["options"]) <= len(data["questions"])
                or set(data["option_labels"]) != set(data["options"])
                or not data["text"].strip()
            ):
                raise serializers.ValidationError(
                    "Multiple-answer groups need a source prompt, complete option labels and 2–10 answer slots."
                )
        if data["kind"] == "table":
            numbers = [q["number"] for q in data["questions"]]
            markers = [
                int(n)
                for row in data["rows"]
                for cell in row
                for n in re.findall(r"\{\{(\d+)\}\}", cell)
            ]
            if (
                not data["headers"]
                or not data["rows"]
                or any(len(r) != len(data["headers"]) for r in data["rows"])
                or sorted(markers) != sorted(numbers)
            ):
                raise serializers.ValidationError(
                    "Table must contain each question marker exactly once and complete rows/headers."
                )
        return data


class FigureInput(serializers.Serializer):
    page = serializers.IntegerField(min_value=1, max_value=2000)
    crop = serializers.ListField(
        child=serializers.FloatField(min_value=0, max_value=1),
        min_length=4,
        max_length=4,
    )
    alt = serializers.CharField(max_length=2000)
    after_paragraph = serializers.IntegerField(min_value=0, max_value=100)

    def validate_crop(self, crop):
        # Normalized top-left x/y and width/height; clients cannot request other pixels.
        x, y, width, height = crop
        if (
            not all(math.isfinite(v) for v in crop)
            or width <= 0
            or height <= 0
            or x + width > 1
            or y + height > 1
        ):
            raise serializers.ValidationError(
                "Keep the complete figure crop within its page."
            )
        return crop


class ContentInput(serializers.Serializer):
    title = serializers.CharField(max_length=250)
    subtitle = serializers.CharField(max_length=1000, allow_blank=True, default="")
    instructions = serializers.CharField(max_length=2000)
    paragraphs = ParagraphInput(many=True, allow_empty=False)
    groups = GroupInput(many=True, allow_empty=False)
    figures = FigureInput(many=True, default=list)

    def validate(self, data):
        numbers = [q["number"] for g in data["groups"] for q in g["questions"]]
        indices = [index for g in data["groups"] for index in g["figure_indices"]]
        if len(set(indices)) != len(indices) or any(
            index >= len(data["figures"]) for index in indices
        ):
            raise serializers.ValidationError(
                "Each question figure must reference one existing figure once."
            )
        if len(data["figures"]) > 10 or any(
            f["after_paragraph"] > len(data["paragraphs"]) for f in data["figures"]
        ):
            raise serializers.ValidationError(
                "Place at most ten figures within the passage."
            )
        if (
            len(data["paragraphs"]) > 100
            or len(data["groups"]) > 40
            or len(numbers) > 40
            or numbers != list(range(numbers[0], numbers[0] + len(numbers)))
        ):
            raise serializers.ValidationError(
                "Keep passage and questions bounded, consecutive and ordered."
            )
        return data


class VersionInput(serializers.Serializer):
    content = ContentInput()
    keys = serializers.DictField(
        child=serializers.ListField(
            child=serializers.CharField(max_length=200), min_length=1, max_length=15
        )
    )
    source_name = serializers.CharField(max_length=250)
    license = serializers.CharField(max_length=500)
    rights_confirmed = serializers.BooleanField()
    source_pages = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=2000),
        min_length=1,
        max_length=50,
    )
    key_pages = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=2000),
        min_length=1,
        max_length=20,
    )
    review_notes = serializers.CharField(max_length=10000, allow_blank=True, default="")

    def validate(self, data):
        if len(set(data["source_pages"])) != len(data["source_pages"]) or len(
            set(data["key_pages"])
        ) != len(data["key_pages"]):
            raise serializers.ValidationError("Source page references must not repeat.")
        qs = [q for g in data["content"]["groups"] for q in g["questions"]]
        if any(
            f["page"] not in data["source_pages"] or f["page"] in data["key_pages"]
            for f in data["content"]["figures"]
        ):
            raise serializers.ValidationError(
                "Figures must use passage pages, never answer-key pages."
            )
        if set(data["keys"]) != {str(q["number"]) for q in qs}:
            raise serializers.ValidationError(
                "Provide reviewed keys for every question, with no extras."
            )
        for g in data["content"]["groups"]:
            for pool in g.get("unordered_sets", []):
                key_sets = [data["keys"][str(number)] for number in pool]
                expected = {normalize(key) for key in key_sets[0]}
                if not all(expected) or len(expected) != len(pool) or any(
                    len(keys) != len(pool)
                    or {normalize(key) for key in keys} != expected
                    for keys in key_sets
                ):
                    raise serializers.ValidationError(
                        "Unordered text slots require the same distinct source answers, one per slot."
                    )
            choices = {
                "true_false": ["TRUE", "FALSE", "NOT GIVEN"],
                "yes_no": ["YES", "NO", "NOT GIVEN"],
            }.get(
                g["kind"],
                g["options"]
                if g["kind"]
                in {"choice", "multiple_choice", "headings", "matching", "completion"}
                else None,
            )
            if g["kind"] == "multiple_choice":
                sets = [data["keys"][str(q["number"])] for q in g["questions"]]
                expected = set(sets[0])
                if len(expected) != len(g["questions"]) or any(
                    len(keys) != len(g["questions"]) or set(keys) != expected
                    for keys in sets
                ):
                    raise serializers.ValidationError(
                        "Each unordered answer slot must have the same distinct source keys, one per required answer."
                    )
            for q in g["questions"]:
                for key in data["keys"][str(q["number"])]:
                    if choices and key not in choices:
                        raise serializers.ValidationError(
                            "A key does not match its question choices."
                        )
        return data


class PaperInput(serializers.Serializer):
    book = serializers.CharField(max_length=150)
    test = serializers.IntegerField(min_value=1, max_value=100)
    passage = serializers.IntegerField(min_value=1, max_value=3)


class PublishInput(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)
    confirm_review = serializers.BooleanField()


class StartInput(serializers.Serializer):
    paper = serializers.IntegerField(min_value=1)


class AnswersInput(serializers.Serializer):
    answers = serializers.DictField(
        child=serializers.CharField(
            max_length=500, allow_blank=True, trim_whitespace=False
        )
    )


class FullStartInput(StartInput):
    timed = serializers.BooleanField(default=True)
