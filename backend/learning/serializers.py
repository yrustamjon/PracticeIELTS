from django.db.models import Count
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import AudioAsset, Category, Material, Segment


class StrictIntegerField(serializers.IntegerField):
    def to_internal_value(self, data):
        if type(data) is not int:
            self.fail("invalid")
        return super().to_internal_value(data)


class PracticeTimingInput(serializers.Serializer):
    position = StrictIntegerField(min_value=0)
    start_ms = StrictIntegerField(min_value=0)
    end_ms = StrictIntegerField(min_value=1)
    revision = StrictIntegerField(min_value=1, allow_null=True)


class CategorySerializer(serializers.ModelSerializer):
    material_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "description", "parent", "position", "material_count"]

    def get_material_count(self, obj) -> int:
        q = obj.materials.all()
        if not self.context["request"].user.can_edit:
            q = q.filter(published_version__isnull=False)
        return q.count()

    def validate_parent(self, value):
        current = value
        visited = set()
        while current:
            if current.pk in visited or (
                self.instance and current.pk == self.instance.pk
            ):
                raise serializers.ValidationError("A category cannot contain itself.")
            visited.add(current.pk)
            current = current.parent
        return value


class SegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Segment
        fields = [
            "id",
            "text",
            "speaker",
            "start_ms",
            "end_ms",
            "position",
            "confidence",
            "needs_review",
        ]


class AudioSerializer(serializers.ModelSerializer):
    stream_url = serializers.SerializerMethodField()

    class Meta:
        model = AudioAsset
        fields = ["id", "duration_ms", "mime_type", "size", "stream_url"]

    def get_stream_url(self, obj) -> str:
        return f"/api/v1/audio/{obj.pk}/stream/"


class MaterialSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    status = serializers.SerializerMethodField()
    audio = serializers.SerializerMethodField()
    segments = serializers.SerializerMethodField()
    version_id = serializers.SerializerMethodField()
    processing = serializers.SerializerMethodField()
    transcript_origin = serializers.SerializerMethodField()
    transcript_warnings = serializers.SerializerMethodField()
    mock_available = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()
    part_question_counts = serializers.SerializerMethodField()
    transcript_audio_id = serializers.SerializerMethodField()
    test_part = serializers.SerializerMethodField()
    full_test = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = [
            "id",
            "title",
            "description",
            "category",
            "category_name",
            "source",
            "license",
            "rights_confirmed",
            "status",
            "audio",
            "segments",
            "version_id",
            "updated_at",
            "processing",
            "transcript_origin",
            "transcript_warnings",
            "mock_available",
            "question_count",
            "part_question_counts",
            "transcript_audio_id",
            "test_part",
            "full_test",
        ]

    def version(self, obj):
        user = self.context["request"].user
        if (
            user.can_edit
            and (user.is_staff or user.role == "admin" or obj.owner_id == user.pk)
            and self.context.get("view")
            and self.context["view"].action == "retrieve"
        ):
            return obj.versions.first()
        return obj.published_version

    def get_status(self, obj) -> str:
        return "published" if obj.published_version_id else "draft"

    @extend_schema_field(AudioSerializer(allow_null=True))
    def get_audio(self, obj):
        version = self.version(obj)
        user = self.context["request"].user
        if user.can_edit and (
            user.is_staff or user.role == "admin" or obj.owner_id == user.pk
        ):
            latest = obj.audio_assets.order_by("-id").first()
            return AudioSerializer(latest).data if latest else None
        asset = (
            version.audio
            if version
            else obj.audio_assets.order_by("-id").first()
            if self.context["request"].user.can_edit
            else None
        )
        return AudioSerializer(asset).data if asset else None

    @extend_schema_field(SegmentSerializer(many=True))
    def get_segments(self, obj):
        if self.context.get("view") and self.context["view"].action != "retrieve":
            return []
        version = self.version(obj)
        return (
            SegmentSerializer(version.segments.all(), many=True).data if version else []
        )

    def get_version_id(self, obj) -> int | None:
        version = self.version(obj)
        return version.pk if version else None

    @extend_schema_field(serializers.JSONField(allow_null=True))
    def get_processing(self, obj):
        user = self.context["request"].user
        if user.can_edit and (
            user.is_staff or user.role == "admin" or obj.owner_id == user.pk
        ):
            from processing.services import job_data

            return job_data(obj.processing_jobs.first())
        return None

    def get_transcript_origin(self, obj) -> str:
        version = self.version(obj)
        return version.origin if version else ""

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_transcript_warnings(self, obj):
        version = self.version(obj)
        return version.warnings if version else []

    def get_mock_available(self, obj) -> bool:
        return bool(obj.published_questions_id)

    def get_question_count(self, obj) -> int:
        user = self.context["request"].user
        if user.can_edit and (
            user.is_staff or user.role == "admin" or obj.owner_id == user.pk
        ):
            qs = obj.question_sets.first()
        else:
            qs = obj.published_questions
        return qs.questions.count() if qs else 0

    @extend_schema_field(serializers.DictField(child=serializers.IntegerField()))
    def get_part_question_counts(self, obj) -> dict[str, int]:
        user = self.context["request"].user
        if user.can_edit and (
            user.is_staff or user.role == "admin" or obj.owner_id == user.pk
        ):
            question_set = obj.question_sets.first()
        else:
            question_set = obj.published_questions
        if not question_set:
            return {}
        return {
            str(row["part"]): row["total"]
            for row in question_set.questions.values("part").annotate(total=Count("id"))
        }

    def get_transcript_audio_id(self, obj) -> int | None:
        version = self.version(obj)
        return version.audio_id if version else None

    def get_test_part(self, obj) -> dict | None:
        from .models import TestPart

        part = TestPart.objects.filter(material=obj).first()
        return {"test": part.test_id, "number": part.number} if part else None

    def get_full_test(self, obj) -> int | None:
        from .models import ListeningTest

        return (
            ListeningTest.objects.filter(full_material=obj)
            .values_list("pk", flat=True)
            .first()
        )
