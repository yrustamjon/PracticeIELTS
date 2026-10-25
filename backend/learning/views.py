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

from exams.html_paper import import_question_html
from exams.intake import document_drafts
from exams.models import QuestionDocument
from exams.serializers import (
    QuestionDocumentSerializer,
    QuestionDraftInput,
    QuestionSetInput,
)
from exams.services import (
    active_material_ids,
    guard_study,
    question_set_data,
    save_question_set,
)
from processing.documents import extract_pdf_text, reference_from_request
from processing.services import job_data, queue_job

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
        if self.request.query_params.get("mock_available") == "true":
            q = q.filter(published_questions__isnull=False)
        if self.request.query_params.get("standalone") == "true":
            q = q.filter(test_part__isnull=True, full_test__isnull=True)
        return q.distinct()

    def retrieve(self, request, *args, **kwargs):
        material = self.get_object()
        guard_study(request.user, material.pk)
        return Response(self.get_serializer(material).data)

    def editor_material(self, request):
        material = self.get_object()
        if not request.user.can_edit or not (
            request.user.is_staff
            or request.user.role == "admin"
            or material.owner_id == request.user.pk
        ):
            raise PermissionDenied("Only authorized editors can manage this material.")
        return material

    @extend_schema(
        request=inline_serializer(
            name="QuestionDocumentUpload", fields={"file": serializers.FileField()}
        ),
        responses=QuestionDocumentSerializer,
    )
    @action(detail=True, methods=["get", "post"], url_path="question-document")
    def question_document(self, request, pk=None):
        material = self.editor_material(request)
        if request.method == "GET":
            document = material.question_documents.first()
            return Response(
                QuestionDocumentSerializer(document).data if document else None
            )
        upload = request.FILES.get("file")
        if not upload or not upload.name.lower().endswith(".pdf"):
            raise ValidationError({"file": "Choose a PDF question paper."})
        data = upload.read(15 * 1024 * 1024 + 1)
        text, pages = extract_pdf_text(data)
        upload.seek(0)
        document = QuestionDocument.objects.create(
            material=material,
            file=upload,
            extracted_text=text,
            page_count=pages,
            extraction_state="extracted" if text else "needs_manual",
        )
        AuditLog.objects.create(
            actor=request.user, material=material, action="questions.pdf_upload"
        )
        return Response(QuestionDocumentSerializer(document).data, status=201)

    @extend_schema(request=QuestionSetInput, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["get", "put"])
    def questions(self, request, pk=None):
        material = self.editor_material(request)
        if request.method == "GET":
            return Response(question_set_data(material.question_sets.first()))
        from .models import TestPart

        part = TestPart.objects.filter(material=material).first()
        serializer = QuestionSetInput(
            data=request.data, context={"assigned_part": part.number if part else None}
        )
        serializer.is_valid(raise_exception=True)
        qs = save_question_set(material, serializer.validated_data, request.user)
        return Response(question_set_data(qs), status=201)

    @extend_schema(
        request=inline_serializer(
            name="QuestionDraftRequest",
            fields={
                "document": serializers.IntegerField(),
                "pages": serializers.ListField(
                    child=serializers.IntegerField(min_value=1, max_value=50),
                    allow_empty=False,
                    max_length=50,
                ),
            },
        ),
        responses=OpenApiTypes.OBJECT,
    )
    @action(detail=True, methods=["post"], url_path="question-drafts")
    def question_drafts(self, request, pk=None):
        material = self.editor_material(request)
        # Validate through a separate serializer so malformed page arrays never
        # reach the PDF reader and another material's private PDF stays private.
        serializer = QuestionDraftInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        document = get_object_or_404(material.question_documents, pk=data["document"])
        return Response(document_drafts(document, data["pages"]))

    @extend_schema(
        request=inline_serializer(
            name="QuestionHtmlUpload", fields={"file": serializers.FileField()}
        ),
        responses=OpenApiTypes.OBJECT,
    )
    @action(detail=True, methods=["post"], url_path="question-html")
    def question_html(self, request, pk=None):
        self.editor_material(request)
        file = request.FILES.get("file")
        if (
            not file
            or not file.name.lower().endswith((".html", ".htm"))
            or file.size > 1_000_000
        ):
            raise ValidationError(
                {"file": "Choose an HTML question paper smaller than 1 MB."}
            )
        try:
            text = file.read().decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValidationError({"file": "Use UTF-8 HTML."}) from exc
        return Response(import_question_html(text))

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
            name="AudioUpload",
            fields={
                "file": serializers.FileField(),
                "reference_text": serializers.CharField(required=False),
                "reference_file": serializers.FileField(required=False),
            },
        ),
        responses={201: AudioSerializer},
    )
    @action(detail=True, methods=["post"])
    def audio(self, request, pk=None):
        material = self.get_object()
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "Select an audio file."})
        reference = reference_from_request(request)
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
        from .models import ListeningTest

        ListeningTest.objects.filter(full_material=material).update(
            assembly_signature=[],
            assembly_state="ready" if material.published_version_id else "waiting",
            assembly_error="",
        )
        job = queue_job(asset, request.user, reference)
        return Response(
            {**AudioSerializer(asset).data, "processing": job_data(job)}, status=201
        )

    @extend_schema(
        request=inline_serializer(
            name="ProcessAudio",
            fields={
                "reference_text": serializers.CharField(required=False),
                "force": serializers.BooleanField(required=False),
            },
        ),
        responses=OpenApiTypes.OBJECT,
    )
    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        material = self.get_object()
        reference = reference_from_request(request)
        if "reference_text" not in request.data and not request.FILES.get(
            "reference_file"
        ):
            previous = material.processing_jobs.first()
            reference = previous.reference_text if previous else ""
        audio = material.audio_assets.order_by("-id").first()
        if not audio:
            raise ValidationError({"detail": "Upload audio first."})
        force = serializers.BooleanField().run_validation(
            request.data.get("force", False)
        )
        job = queue_job(audio, request.user, reference, force)
        return Response(job_data(job), status=202)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["get"])
    def processing(self, request, pk=None):
        material = self.get_object()
        if not request.user.can_edit or not (
            request.user.is_staff
            or request.user.role == "admin"
            or material.owner_id == request.user.pk
        ):
            raise PermissionDenied("Only authorized editors can view processing jobs.")
        return Response(job_data(material.processing_jobs.first()))

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
        previous_version = material.versions.first()
        old_segments = (
            list(previous_version.segments.all())
            if previous_version and previous_version.audio_id == audio.pk
            else []
        )
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
            timing_fields = {}
            if index < len(old_segments) and old_segments[index].words:
                old = old_segments[index]
                if old.text == text and old.start_ms == start and old.end_ms == end:
                    timing_fields = {
                        "words": old.words,
                        "confidence": old.confidence,
                        "needs_review": old.needs_review,
                    }
                elif old.start_ms == start and old.end_ms == end:
                    from processing.segmentation import align_reference
                    from processing.transcription import ReferenceMismatch

                    try:
                        mapped = align_reference(text, old.words)
                        merged_words = [
                            w for sentence in mapped for w in sentence["words"]
                        ]
                        timing_fields = {
                            "words": merged_words,
                            "confidence": min(s["confidence"] for s in mapped),
                            "needs_review": any(s["needs_review"] for s in mapped),
                        }
                    except ReferenceMismatch:
                        timing_fields = {
                            "words": [],
                            "confidence": None,
                            "needs_review": True,
                        }
                else:
                    timing_fields = {
                        "words": [],
                        "confidence": None,
                        "needs_review": True,
                    }
            clean.append(
                dict(
                    position=index,
                    text=text,
                    speaker=speaker,
                    start_ms=start,
                    end_ms=end,
                    **timing_fields,
                )
            )
            last = end
        with transaction.atomic():
            version = TranscriptVersion.objects.create(
                material=material,
                audio=audio,
                origin="edited"
                if previous_version and previous_version.origin != "manual"
                else "manual",
            )
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
        if (
            version.origin != "manual"
            and request.data.get("confirm_review") is not True
        ):
            raise ValidationError(
                {
                    "detail": "Review the generated transcript and explicitly confirm it before publishing."
                }
            )
        question_set = material.question_sets.first()
        if question_set and question_set.audio_id != version.audio_id:
            raise ValidationError(
                {
                    "detail": "The questions belong to a previous recording. Review and save them for the current audio before publishing."
                }
            )
        with transaction.atomic():
            if question_set and not question_set.published_at:
                question_set.published_at = timezone.now()
                question_set.save(update_fields=["published_at"])
            material.published_questions = question_set
            if not version.published_at:
                version.published_at = timezone.now()
                version.save(update_fields=["published_at"])
            material.published_version = version
            material.save()
            AuditLog.objects.create(
                actor=request.user, material=material, action="material.publish"
            )
        from .models import TestPart
        from .test_assembly import queue_assembly

        part = TestPart.objects.filter(material=material).first()
        if part:
            transaction.on_commit(lambda: queue_assembly(part.test_id))
        from .models import ListeningTest

        ListeningTest.objects.filter(full_material=material).update(
            assembly_signature=[], assembly_state="ready", assembly_error=""
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
        guard_study(request.user, asset.material_id)
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
        "grouping_version": session.grouping_version,
        "position": session.position,
        "drafts": session.drafts,
        "groups": [
            {
                "start_ms": g["start_ms"],
                "end_ms": g["end_ms"],
                "speaker": g["speaker"],
                **({"word_count": g["word_count"]} if "word_count" in g else {}),
            }
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
        instance = get_object_or_404(
            PracticeSession.objects.select_related(
                "version", "material", "version__audio"
            ),
            pk=pk,
            user=request.user,
        )
        guard_study(request.user, instance.material_id)
        return instance

    def list(self, request):
        return Response(
            {
                "results": [
                    session_data(s)
                    for s in PracticeSession.objects.filter(user=request.user)
                    .exclude(material_id__in=active_material_ids(request.user))
                    .order_by("-updated_at")[:50]
                ]
            }
        )

    def create(self, request):
        material = get_object_or_404(
            Material, pk=request.data.get("material"), published_version__isnull=False
        )
        guard_study(request.user, material.pk)
        difficulty = request.data.get("difficulty", "easy")
        if difficulty not in ("easy", "medium", "hard", "full"):
            raise ValidationError({"difficulty": "Choose easy, medium, hard or full."})
        session, _ = PracticeSession.objects.get_or_create(
            user=request.user,
            material=material,
            version=material.published_version,
            difficulty=difficulty,
            grouping_version=1,
        )
        return Response(session_data(session))

    def retrieve(self, request, pk=None):
        return Response(session_data(self.own(request, pk)))

    def partial_update(self, request, pk=None):
        with transaction.atomic():
            session = get_object_or_404(
                PracticeSession.objects.select_for_update(), pk=pk, user=request.user
            )
            guard_study(request.user, session.material_id)
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
        try:
            result = compare(intervals[position]["text"], answer, options)
        except ValueError as exc:
            raise ValidationError({"answer": str(exc)}) from exc
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
        q = (
            StudentResponse.objects.filter(session__user=request.user)
            .exclude(session__material_id__in=active_material_ids(request.user))
            .select_related("session__material")
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
