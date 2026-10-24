import re
from datetime import timedelta

from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AudioAsset,
    AuditLog,
    Category,
    Material,
    PracticeSession,
    Segment,
    StudentResponse,
    TranscriptVersion,
)
from .schema import (
    CheckRequest,
    ComparisonSchema,
    ProgressSchema,
    ResponseSchema,
    SessionCreate,
    SessionSchema,
    SessionUpdate,
)
from .serializers import AudioSerializer, CategorySerializer, MaterialSerializer
from .services.audio import inspect_audio
from .services.comparison import compare, groups


class EditorOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.method in ("GET", "HEAD", "OPTIONS") or request.user.can_edit
        )

    def has_object_permission(self, request, view, obj):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user.can_edit and (
            not isinstance(obj, Material)
            or request.user.is_staff
            or request.user.role == "admin"
            or obj.owner_id == request.user.pk
        )


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.select_related("parent").all()
    serializer_class = CategorySerializer
    permission_classes = [EditorOrReadOnly]
    search_fields = ["name", "description"]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            raise ValidationError(
                {
                    "detail": "Move the child categories and materials before deleting this category."
                }
            )


class MaterialViewSet(viewsets.ModelViewSet):
    serializer_class = MaterialSerializer
    permission_classes = [EditorOrReadOnly]
    search_fields = ["title", "description", "category__name"]
    filterset_fields = ["category"]
    http_method_names = ["get", "post", "patch", "put", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Material.objects.none()
        q = Material.objects.select_related("category", "published_version").all()
        if not self.request.user.can_edit:
            q = q.filter(published_version__isnull=False)
        elif self.request.user.role == "teacher" and not self.request.user.is_staff:
            q = q.filter(owner=self.request.user) | q.filter(
                published_version__isnull=False
            )
        return q.distinct()

    def perform_create(self, serializer):
        obj = serializer.save(owner=self.request.user)
        AuditLog.objects.create(
            actor=self.request.user, material=obj, action="material.create"
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        AuditLog.objects.create(
            actor=self.request.user, material=obj, action="material.update"
        )

    @extend_schema(
        request=inline_serializer(
            name="AudioUpload", fields={"file": serializers.FileField()}
        ),
        responses={201: AudioSerializer},
    )
    @action(detail=True, methods=["post"])
    def audio(self, request, pk=None):
        material = self.get_object()
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "Select an audio file."})
        duration, mime = inspect_audio(upload)
        asset = AudioAsset.objects.create(
            material=material,
            file=upload,
            duration_ms=duration,
            mime_type=mime,
            size=upload.size,
        )
        AuditLog.objects.create(
            actor=request.user, material=material, action="audio.upload"
        )
        return Response(AudioSerializer(asset).data, status=201)

    @extend_schema(
        request=inline_serializer(
            name="SaveTranscript",
            fields={"segments": serializers.ListField(child=serializers.DictField())},
        ),
        responses={201: OpenApiTypes.OBJECT},
    )
    @action(detail=True, methods=["put"])
    def transcript(self, request, pk=None):
        material = self.get_object()
        audio = material.audio_assets.order_by("-id").first()
        if not audio:
            raise ValidationError({"detail": "Upload audio first."})
        data = request.data.get("segments")
        if not isinstance(data, list) or not data or len(data) > 3000:
            raise ValidationError({"segments": "Provide 1–3000 segments."})
        clean = []
        last = 0
        for index, segment in enumerate(data):
            try:
                start, end = segment["start_ms"], segment["end_ms"]
                text = segment["text"].strip()
                speaker = segment.get("speaker", "").strip()
                if (
                    isinstance(start, bool)
                    or not isinstance(start, int)
                    or not isinstance(end, int)
                    or start < last
                    or end <= start
                    or end > audio.duration_ms
                    or not text
                    or len(text) > 10000
                    or len(speaker) > 100
                ):
                    raise ValueError()
            except (KeyError, ValueError, AttributeError, TypeError):
                raise ValidationError(
                    {
                        "segments": f"Segment {index + 1}: require text and non-overlapping integer timestamps within {audio.duration_ms} ms."
                    }
                )
            clean.append(
                dict(
                    position=index,
                    text=text,
                    speaker=speaker,
                    start_ms=start,
                    end_ms=end,
                )
            )
            last = end
        with transaction.atomic():
            version = TranscriptVersion.objects.create(material=material, audio=audio)
            Segment.objects.bulk_create([Segment(version=version, **s) for s in clean])
            AuditLog.objects.create(
                actor=request.user, material=material, action="transcript.version"
            )
        return Response({"version_id": version.pk, "segments": len(clean)}, status=201)

    @extend_schema(request=None, responses=MaterialSerializer)
    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        material = self.get_object()
        version = material.versions.first()
        if not material.rights_confirmed or not material.source or not material.license:
            raise ValidationError(
                {
                    "detail": "Confirm ownership/permission and provide source and license before publishing."
                }
            )
        if not version or not version.segments.exists():
            raise ValidationError({"detail": "Save and review a transcript first."})
        if version.audio_id != material.audio_assets.order_by("-id").first().pk:
            raise ValidationError(
                {
                    "detail": "Audio changed: align and save a new transcript before publishing."
                }
            )
        with transaction.atomic():
            version.published_at = timezone.now()
            version.save(update_fields=["published_at"])
            material.published_version = version
            material.save()
            AuditLog.objects.create(
                actor=request.user, material=material, action="material.publish"
            )
        return Response(self.get_serializer(material).data)


@extend_schema_view(
    get=extend_schema(
        responses={
            (200, "audio/wav"): OpenApiTypes.BINARY,
            (206, "audio/wav"): OpenApiTypes.BINARY,
        },
        parameters=[OpenApiParameter("Range", str, OpenApiParameter.HEADER)],
    )
)
class AudioStream(APIView):
    def get(self, request, pk):
        asset = get_object_or_404(AudioAsset, pk=pk)
        permitted = TranscriptVersion.objects.filter(
            audio=asset, published_at__isnull=False
        ).exists() or (
            request.user.can_edit
            and (
                request.user.is_staff
                or request.user.role == "admin"
                or asset.material.owner_id == request.user.pk
            )
        )
        if not permitted:
            raise PermissionDenied("This audio is private.")
        total = asset.size
        start = 0
        end = total - 1
        status = 200
        header = request.headers.get("Range")
        if header:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", header)
            if not match or not any(match.groups()):
                return Response(
                    status=416, headers={"Content-Range": f"bytes */{total}"}
                )
            left, right = match.groups()
            if not left:
                start = max(0, total - int(right))
            else:
                start = int(left)
                end = min(int(right), end) if right else end
            if start > end or start >= total:
                return Response(
                    status=416, headers={"Content-Range": f"bytes */{total}"}
                )
            status = 206

        def stream():
            with asset.file.open("rb") as file:
                file.seek(start)
                remaining = end - start + 1
                while remaining > 0:
                    chunk = file.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        response = StreamingHttpResponse(
            stream(), status=status, content_type=asset.mime_type
        )
        response["Accept-Ranges"] = "bytes"
        response["Content-Length"] = str(end - start + 1)
        response["Cache-Control"] = "private, no-store"
        if status == 206:
            response["Content-Range"] = f"bytes {start}-{end}/{total}"
        return response


def session_data(session):
    intervals = groups(session)
    return {
        "id": session.pk,
        "material": session.material_id,
        "title": session.material.title,
        "version": session.version_id,
        "difficulty": session.difficulty,
        "position": session.position,
        "drafts": session.drafts,
        "groups": [
            {"start_ms": g["start_ms"], "end_ms": g["end_ms"], "speaker": g["speaker"]}
            for g in intervals
        ],
        "audio": AudioSerializer(session.version.audio).data,
        "checked_positions": list(
            session.responses.values_list("position", flat=True).distinct()
        ),
    }


@extend_schema_view(
    list=extend_schema(
        operation_id="sessions_list",
        responses=inline_serializer(
            name="SessionList",
            fields={"results": serializers.ListField(child=SessionSchema)},
        ),
    ),
    create=extend_schema(request=SessionCreate, responses=SessionSchema),
    retrieve=extend_schema(responses=SessionSchema),
    partial_update=extend_schema(request=SessionUpdate, responses=SessionSchema),
    check=extend_schema(request=CheckRequest, responses=ComparisonSchema),
    hint=extend_schema(
        responses=inline_serializer(
            name="PracticeHint",
            fields={
                "hint": serializers.CharField(),
                "transcript": serializers.CharField(allow_null=True),
            },
        )
    ),
)
class SessionViewSet(viewsets.ViewSet):
    queryset = PracticeSession.objects.none()

    def own(self, request, pk):
        return get_object_or_404(
            PracticeSession.objects.select_related(
                "version", "material", "version__audio"
            ),
            pk=pk,
            user=request.user,
        )

    def list(self, request):
        return Response(
            {
                "results": [
                    session_data(s)
                    for s in PracticeSession.objects.filter(user=request.user).order_by(
                        "-updated_at"
                    )[:50]
                ]
            }
        )

    def create(self, request):
        material = get_object_or_404(
            Material, pk=request.data.get("material"), published_version__isnull=False
        )
        difficulty = request.data.get("difficulty", "easy")
        if difficulty not in ("easy", "medium", "hard", "full"):
            raise ValidationError({"difficulty": "Choose easy, medium, hard or full."})
        session, _ = PracticeSession.objects.get_or_create(
            user=request.user,
            material=material,
            version=material.published_version,
            difficulty=difficulty,
        )
        return Response(session_data(session))

    def retrieve(self, request, pk=None):
        return Response(session_data(self.own(request, pk)))

    def partial_update(self, request, pk=None):
        with transaction.atomic():
            session = get_object_or_404(
                PracticeSession.objects.select_for_update(), pk=pk, user=request.user
            )
            position = request.data.get("position", session.position)
            intervals = groups(session)
            if (
                isinstance(position, bool)
                or not isinstance(position, int)
                or not 0 <= position < len(intervals)
            ):
                raise ValidationError({"position": "Invalid segment."})
            if "draft" in request.data:
                draft = request.data["draft"]
                if not isinstance(draft, str) or len(draft) > 20000:
                    raise ValidationError({"draft": "Answer is too long."})
                draft_position = request.data.get("draft_position", session.position)
                if not isinstance(draft_position, int) or not 0 <= draft_position < len(
                    intervals
                ):
                    raise ValidationError({"draft_position": "Invalid segment."})
                session.drafts[str(draft_position)] = draft
            session.position = position
            session.save()
        return Response(session_data(session))

    @action(detail=True, methods=["post"])
    def check(self, request, pk=None):
        session = self.own(request, pk)
        intervals = groups(session)
        position = request.data.get("position", session.position)
        answer = request.data.get("answer", "")
        options = request.data.get("normalization", {})
        if not isinstance(position, int) or not 0 <= position < len(intervals):
            raise ValidationError({"position": "Invalid segment."})
        if not isinstance(answer, str) or len(answer) > 20000:
            raise ValidationError({"answer": "Answer is too long."})
        if not isinstance(options, dict) or any(
            k
            not in (
                "capitalization",
                "punctuation",
                "contractions",
                "numbers",
                "whitespace",
            )
            or not isinstance(v, bool)
            for k, v in options.items()
        ):
            raise ValidationError(
                {"normalization": "Use boolean normalization options."}
            )
        result = compare(intervals[position]["text"], answer, options)
        StudentResponse.objects.create(
            session=session, position=position, original_answer=answer, result=result
        )
        return Response(result)

    @action(detail=True, methods=["get"])
    def hint(self, request, pk=None):
        session = self.own(request, pk)
        text = groups(session)[session.position]["text"]
        return Response(
            {
                "hint": " ".join(
                    word[0] + "_" * max(0, len(word) - 1) for word in text.split()
                ),
                "transcript": text
                if request.query_params.get("reveal") == "true"
                else None,
            }
        )


@extend_schema_view(get=extend_schema(responses=ProgressSchema))
class ProgressView(APIView):
    def get(self, request):
        responses = StudentResponse.objects.filter(
            session__user=request.user
        ).select_related("session__material")
        latest = {}
        for response in responses:
            latest.setdefault((response.session_id, response.position), response)
        accuracy = (
            round(sum(r.result["accuracy"] for r in latest.values()) / len(latest))
            if latest
            else None
        )
        today = timezone.localdate()
        week = []
        for offset in range(6, -1, -1):
            date = today - timedelta(days=offset)
            week.append(
                {
                    "day": date.strftime("%a"),
                    "date": date.isoformat(),
                    "count": responses.filter(created_at__date=date).count(),
                }
            )
        recent = (
            PracticeSession.objects.filter(user=request.user)
            .order_by("-updated_at")
            .first()
        )
        completed = sum(
            len(set(s.responses.values_list("position", flat=True))) == len(groups(s))
            for s in PracticeSession.objects.filter(user=request.user)
        )
        return Response(
            {
                "accuracy": accuracy,
                "sentences_completed": len(latest),
                "exercises_completed": completed,
                "attempts": responses.count(),
                "weekly_activity": week,
                "resume": session_data(recent) if recent else None,
                "material_count": Material.objects.filter(
                    published_version__isnull=False
                ).count(),
            }
        )


@extend_schema_view(
    get=extend_schema(
        responses=inline_serializer(
            name="ResponseList",
            fields={"results": serializers.ListField(child=ResponseSchema)},
        )
    )
)
class ResponseView(APIView):
    def get(self, request):
        q = StudentResponse.objects.filter(session__user=request.user).select_related(
            "session__material"
        )
        if request.query_params.get("mistakes") == "true":
            q = q.filter(result__accuracy__lt=100)
        return Response(
            {
                "results": [
                    {
                        "id": r.pk,
                        "session": r.session_id,
                        "position": r.position,
                        "title": r.session.material.title,
                        "answer": r.original_answer,
                        "result": r.result,
                        "created_at": r.created_at,
                    }
                    for r in q[:100]
                ]
            }
        )
