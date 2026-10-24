from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .serializers import AudioSerializer

GroupSchema = inline_serializer(
    name="PlaybackGroup",
    fields={
        "start_ms": serializers.IntegerField(),
        "end_ms": serializers.IntegerField(),
        "speaker": serializers.CharField(),
    },
)
SessionSchema = inline_serializer(
    name="PracticeSession",
    fields={
        "id": serializers.IntegerField(),
        "material": serializers.IntegerField(),
        "title": serializers.CharField(),
        "version": serializers.IntegerField(),
        "difficulty": serializers.CharField(),
        "position": serializers.IntegerField(),
        "drafts": serializers.DictField(child=serializers.CharField()),
        "groups": serializers.ListField(child=GroupSchema),
        "audio": AudioSerializer(),
        "checked_positions": serializers.ListField(child=serializers.IntegerField()),
    },
)
SessionCreate = inline_serializer(
    name="StartPractice",
    fields={
        "material": serializers.IntegerField(),
        "difficulty": serializers.ChoiceField(
            choices=["easy", "medium", "hard", "full"]
        ),
    },
)
SessionUpdate = inline_serializer(
    name="SavePractice",
    fields={
        "position": serializers.IntegerField(required=False),
        "draft": serializers.CharField(required=False, allow_blank=True),
        "draft_position": serializers.IntegerField(required=False),
    },
)
CheckRequest = inline_serializer(
    name="CheckAnswer",
    fields={
        "answer": serializers.CharField(allow_blank=True),
        "position": serializers.IntegerField(required=False),
        "normalization": serializers.DictField(
            child=serializers.BooleanField(), required=False
        ),
    },
)
TokenSchema = inline_serializer(
    name="WordComparison",
    fields={
        "status": serializers.ChoiceField(
            choices=["correct", "incorrect", "missing", "extra"]
        ),
        "expected": serializers.CharField(),
        "actual": serializers.CharField(),
        "reason": serializers.CharField(allow_null=True),
    },
)
ComparisonSchema = inline_serializer(
    name="Comparison",
    fields={
        "accuracy": serializers.IntegerField(),
        "tokens": serializers.ListField(child=TokenSchema),
        "reference": serializers.CharField(),
        "correct_words": serializers.IntegerField(),
        "total_words": serializers.IntegerField(),
    },
)
ProgressSchema = inline_serializer(
    name="LearningProgress",
    fields={
        "accuracy": serializers.IntegerField(allow_null=True),
        "sentences_completed": serializers.IntegerField(),
        "exercises_completed": serializers.IntegerField(),
        "attempts": serializers.IntegerField(),
        "material_count": serializers.IntegerField(),
        "resume": SessionSchema,
        "weekly_activity": serializers.ListField(child=serializers.DictField()),
    },
)
ResponseSchema = inline_serializer(
    name="CheckedResponse",
    fields={
        "id": serializers.IntegerField(),
        "session": serializers.IntegerField(),
        "position": serializers.IntegerField(),
        "title": serializers.CharField(),
        "answer": serializers.CharField(),
        "result": ComparisonSchema,
        "created_at": serializers.DateTimeField(),
    },
)
