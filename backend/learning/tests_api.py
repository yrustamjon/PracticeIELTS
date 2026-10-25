"""Book/test hierarchy. Existing independent materials retain their existing routes."""

from django.db import transaction
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import AuditLog, ListeningTest, Material, TestPart
from .views import EditorOrReadOnly


def manages(user, obj):
    return user.can_edit and (
        user.is_staff or user.role == "admin" or obj.owner_id == user.pk
    )


class ListeningTestSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    parts = serializers.SerializerMethodField()
    full = serializers.SerializerMethodField()
    assembly_state = serializers.CharField(read_only=True)
    assembly_error = serializers.SerializerMethodField()
    full_source = serializers.SerializerMethodField()

    class Meta:
        model = ListeningTest
        fields = [
            "id",
            "title",
            "category",
            "category_name",
            "parts",
            "full",
            "assembly_state",
            "assembly_error",
            "full_source",
        ]

    def validate_category(self, value):
        if value.parent_id is None or value.children.exists():
            raise serializers.ValidationError(
                "Choose a volume inside a book, for example Cambridge → Cambridge 10, before creating a test."
            )
        return value

    def summary(self, m):
        return {
            "id": m.pk,
            "title": m.title,
            "status": "published" if m.published_version_id else "draft",
            "mock_available": bool(m.published_questions_id),
            "question_count": m.published_questions.questions.count()
            if m.published_questions_id
            else 0,
        }

    def get_full_source(self, obj) -> str:
        return (
            "upload"
            if obj.full_material_id and not obj.assembly_signature
            else "assembled"
        )

    def get_parts(self, obj) -> list[dict]:
        editor = manages(self.context["request"].user, obj)
        return [
            {"number": p.number, **self.summary(p.material)}
            for p in obj.parts.select_related("material__published_questions")
            if editor or p.material.published_version_id
        ]

    def get_full(self, obj) -> dict | None:
        if obj.full_material_id and (
            obj.full_material.published_version_id
            or manages(self.context["request"].user, obj)
        ):
            return self.summary(obj.full_material)
        return None

    def get_assembly_error(self, obj) -> str:
        return obj.assembly_error if manages(self.context["request"].user, obj) else ""


class PartInput(serializers.Serializer):
    number = serializers.IntegerField(min_value=1, max_value=4)
    material = serializers.IntegerField(required=False)


class FullInput(serializers.Serializer):
    material = serializers.IntegerField(required=False)


class ListeningTestViewSet(viewsets.ModelViewSet):
    serializer_class = ListeningTestSerializer
    permission_classes = [EditorOrReadOnly]
    http_method_names = ["get", "post", "patch", "head", "options"]
    filterset_fields = ["category"]
    search_fields = ["title", "category__name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ListeningTest.objects.none()
        user = self.request.user
        q = ListeningTest.objects.select_related(
            "category", "full_material__published_questions"
        ).prefetch_related("parts__material")
        visible = Q(parts__material__published_version__isnull=False) | Q(
            full_material__published_version__isnull=False
        )
        if (
            self.request.query_params.get("owned") == "true"
            and user.role == "teacher"
            and not user.is_staff
        ):
            return q.filter(owner=user)
        if not user.can_edit:
            return q.filter(visible).distinct()
        if user.role == "teacher" and not user.is_staff:
            return q.filter(Q(owner=user) | visible).distinct()
        return q

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def editable(self):
        obj = self.get_object()
        if not manages(self.request.user, obj):
            raise PermissionDenied("Only the test owner can manage its parts.")
        return obj

    def perform_update(self, serializer):
        original_category = self.editable().category_id
        with transaction.atomic():
            updated = serializer.save()
            if original_category != updated.category_id:
                ids = list(updated.parts.values_list("material_id", flat=True))
                if updated.full_material_id:
                    ids.append(updated.full_material_id)
                Material.objects.filter(pk__in=ids).update(category=updated.category)
            AuditLog.objects.create(
                actor=self.request.user,
                material=updated.full_material,
                action="test.update",
            )

    @extend_schema(request=PartInput, responses=ListeningTestSerializer)
    @action(detail=True, methods=["post"])
    def parts(self, request, pk=None):
        test = self.editable()
        s = PartInput(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            ListeningTest.objects.select_for_update().get(pk=test.pk)
            existing = test.parts.filter(number=s.validated_data["number"]).first()
            if not existing:
                material_id = s.validated_data.get("material")
                if material_id:
                    material = Material.objects.filter(pk=material_id).first()
                    if not material or not manages(request.user, material):
                        raise PermissionDenied("Choose one of your own materials.")
                    if (
                        TestPart.objects.filter(material=material).exists()
                        or ListeningTest.objects.filter(full_material=material).exists()
                    ):
                        raise ValidationError(
                            {"material": "This material already belongs to a test."}
                        )
                    if (
                        material.published_questions_id
                        and material.published_questions.questions.values("part")
                        .distinct()
                        .count()
                        > 1
                    ):
                        raise ValidationError(
                            {
                                "material": "Attach a single-part material, not a complete four-part paper."
                            }
                        )
                else:
                    material = Material.objects.create(
                        title=f"{test.title} · Part {s.validated_data['number']}",
                        category=test.category,
                        owner=request.user,
                    )
                TestPart.objects.create(
                    test=test, number=s.validated_data["number"], material=material
                )
        from .test_assembly import queue_assembly

        queue_assembly(test.pk)
        return Response(self.get_serializer(test).data)

    @extend_schema(request=FullInput, responses=ListeningTestSerializer)
    @action(detail=True, methods=["post"], url_path="full-recording")
    def full_recording(self, request, pk=None):
        test = self.editable()
        s = FullInput(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            test = ListeningTest.objects.select_for_update().get(pk=test.pk)
            material_id = s.validated_data.get("material")
            if not material_id and test.full_material_id:
                return Response(self.get_serializer(test).data)
            if material_id:
                material = Material.objects.filter(pk=material_id).first()
                if not material or not manages(request.user, material):
                    raise PermissionDenied("Choose one of your own materials.")
                if (
                    TestPart.objects.filter(material=material).exists()
                    or ListeningTest.objects.filter(full_material=material)
                    .exclude(pk=test.pk)
                    .exists()
                ):
                    raise ValidationError(
                        {
                            "material": "This recording already belongs to another test or Part."
                        }
                    )
            else:
                material = test.full_material or Material.objects.create(
                    title=test.title + " · Full test",
                    category=test.category,
                    owner=request.user,
                )
            test.full_material = material
            test.assembly_signature = []
            test.assembly_state = (
                "ready" if material.published_version_id else "waiting"
            )
            test.assembly_error = ""
            test.save()
        return Response(self.get_serializer(test).data)

    @extend_schema(request=None, responses=ListeningTestSerializer)
    @action(detail=True, methods=["post"])
    def assemble(self, request, pk=None):
        obj = self.editable()
        from .test_assembly import queue_assembly

        queue_assembly(obj.pk, retry=True)
        obj.refresh_from_db()
        return Response(self.get_serializer(obj).data)
