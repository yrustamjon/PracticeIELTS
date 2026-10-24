from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from learning.models import Material

from .models import MockAttempt, QuestionDocument
from .services import (
    attempt_data,
    exam_audio_response,
    expire_if_needed,
    finalize_attempt,
    issue_audio_ticket,
    render_document_page,
)


class StartAttempt(serializers.Serializer):
    material = serializers.IntegerField()
    timing = serializers.ChoiceField(choices=["timed", "untimed"])
    restart = serializers.BooleanField(default=False)


class SaveAttempt(serializers.Serializer):
    answers = serializers.DictField(child=serializers.JSONField())


@extend_schema_view(
    list=extend_schema(
        operation_id="mock_attempts_list", responses=OpenApiTypes.OBJECT
    ),
    create=extend_schema(request=StartAttempt, responses=OpenApiTypes.OBJECT),
    retrieve=extend_schema(responses=OpenApiTypes.OBJECT),
    partial_update=extend_schema(request=SaveAttempt, responses=OpenApiTypes.OBJECT),
)
class MockAttemptViewSet(viewsets.ViewSet):
    queryset = MockAttempt.objects.none()

    def own(self, request, pk):
        return expire_if_needed(
            get_object_or_404(
                MockAttempt.objects.select_related(
                    "material", "question_set", "version__audio"
                ),
                pk=pk,
                user=request.user,
            )
        )

    def list(self, request):
        return Response(
            {
                "results": [
                    attempt_data(a)
                    for a in MockAttempt.objects.filter(user=request.user)
                    .select_related("material", "question_set")
                    .order_by("-started_at")[:50]
                ]
            }
        )

    def create(self, request):
        serializer = StartAttempt(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        material = get_object_or_404(
            Material,
            pk=data["material"],
            published_version__isnull=False,
            published_questions__isnull=False,
        )
        previous = MockAttempt.objects.filter(
            user=request.user, material=material, submitted_at__isnull=True
        ).first()
        if previous:
            previous = expire_if_needed(previous)
            if not previous.submitted_at:
                if data["restart"]:
                    finalize_attempt(previous.pk, request.user)
                else:
                    if previous.timing != data["timing"]:
                        raise ValidationError(
                            {
                                "detail": "An active mock exists in another timing mode. Continue it or explicitly restart."
                            }
                        )
                    return Response(attempt_data(previous))
        with transaction.atomic():
            # The user row serializes concurrent starts, avoiding partial-unique races.
            type(request.user).objects.select_for_update().get(pk=request.user.pk)
            existing = MockAttempt.objects.filter(
                user=request.user, material=material, submitted_at__isnull=True
            ).first()
            if existing:
                return Response(attempt_data(existing))
            qs = material.published_questions
            attempt = MockAttempt.objects.create(
                user=request.user,
                material=material,
                version=material.published_version,
                question_set=qs,
                timing=data["timing"],
                deadline=timezone.now() + timedelta(seconds=qs.duration_seconds)
                if data["timing"] == "timed"
                else None,
            )
        return Response(attempt_data(attempt), status=201)

    def retrieve(self, request, pk=None):
        return Response(attempt_data(self.own(request, pk)))

    def partial_update(self, request, pk=None):
        serializer = SaveAttempt(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            attempt = get_object_or_404(
                MockAttempt.objects.select_for_update(), pk=pk, user=request.user
            )
            attempt = expire_if_needed(attempt)
            if attempt.submitted_at:
                raise ValidationError(
                    {"detail": "This mock has already ended. Answers are read-only."}
                )
            answers = serializer.validated_data["answers"]
            valid_numbers = {
                str(n)
                for n in attempt.question_set.questions.values_list("number", flat=True)
            }
            if set(answers) - valid_numbers:
                raise ValidationError({"answers": "Unknown question number."})
            for key, value in answers.items():
                if (
                    not isinstance(value, (str, list))
                    or (isinstance(value, str) and len(value) > 1000)
                    or (
                        isinstance(value, list)
                        and (
                            len(value) > 20
                            or any(
                                not isinstance(v, str) or len(v) > 100 for v in value
                            )
                        )
                    )
                ):
                    raise ValidationError({"answers": "Invalid answer format."})
            attempt.answers = {**attempt.answers, **answers}
            attempt.save()
        return Response(attempt_data(attempt))

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        attempt = self.own(request, pk)
        return Response(attempt_data(finalize_attempt(attempt.pk, request.user)))

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"], url_path="start-audio")
    def start_audio(self, request, pk=None):
        attempt = self.own(request, pk)
        ticket = issue_audio_ticket(attempt)
        return Response(
            {
                "url": f"/api/v1/mock-attempts/{attempt.pk}/audio/",
                "ticket": ticket,
                "ticket_expires_seconds": 120,
            }
        )

    @extend_schema(
        responses={(200, "audio/mpeg"): OpenApiTypes.BINARY},
        parameters=[OpenApiParameter("X-Exam-Audio", str, OpenApiParameter.HEADER)],
    )
    @action(detail=True, methods=["get"])
    def audio(self, request, pk=None):
        attempt = self.own(request, pk)
        return exam_audio_response(attempt, request.headers.get("X-Exam-Audio", ""))


class TeacherDocumentPage(APIView):
    @extend_schema(responses={(200, "image/png"): OpenApiTypes.BINARY})
    def get(self, request, pk, page):
        document = get_object_or_404(
            QuestionDocument.objects.select_related("material"), pk=pk
        )
        if not request.user.can_edit or not (
            request.user.is_staff
            or request.user.role == "admin"
            or document.material.owner_id == request.user.pk
        ):
            raise PermissionDenied("Only authorized editors can preview this document.")
        return render_document_page(document, page)


class AttemptDocumentPage(APIView):
    @extend_schema(responses={(200, "image/png"): OpenApiTypes.BINARY})
    def get(self, request, pk, page):
        attempt = get_object_or_404(
            MockAttempt.objects.select_related("question_set__document"),
            pk=pk,
            user=request.user,
        )
        qs = attempt.question_set
        if not qs.document_id or page not in qs.document_pages:
            raise PermissionDenied("This PDF page is not available to students.")
        return render_document_page(qs.document, page)
