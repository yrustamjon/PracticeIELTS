from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import AudioAsset, Category, Material, Segment


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
        fields = ["id", "text", "speaker", "start_ms", "end_ms", "position"]


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
