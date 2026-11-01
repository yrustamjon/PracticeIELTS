"""Attach a validated original recording to a new Mock version, preserving attempts."""

from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import PermissionDenied, ValidationError

from learning.models import AudioAsset, AuditLog, Material, TestPart
from learning.services.audio import inspect_audio

from .serializers import QuestionSetInput
from .services import publish_question_set, question_set_data, save_question_set


def attach_mock_audio(material_id, upload, user, source_id):
    if not user.can_edit:
        raise PermissionDenied("Only an authorized editor can import Mock audio.")
    if not isinstance(source_id, str) or not 1 <= len(source_id) <= 200:
        raise ValidationError("Supply a bounded, stable import source identifier.")
    duration, mime = inspect_audio(upload)
    asset = None
    try:
        with transaction.atomic():
            Material.objects.filter(pk=material_id).update(updated_at=F("updated_at"))
            material = Material.objects.select_for_update().get(pk=material_id)
            if not (
                user.is_staff or user.role == "admin" or material.owner_id == user.pk
            ):
                raise PermissionDenied("Only the owner can import this recording.")
            previous = AuditLog.objects.filter(
                material=material,
                action="mock.audio_import",
                details__source_id=source_id,
            ).first()
            if previous:
                return material.question_sets.get(
                    pk=previous.details["question_set"]
                ), False
            paper = material.published_questions
            if not paper:
                raise ValidationError(
                    "Publish reviewed questions before attaching Mock audio."
                )
            if paper.audio_id:
                raise ValidationError(
                    "This Mock already has a recording; review a replacement through the content studio."
                )
            payload = question_set_data(paper)
            part = (
                TestPart.objects.filter(material=material)
                .values_list("number", flat=True)
                .first()
            )
            validator = QuestionSetInput(data=payload, context={"assigned_part": part})
            validator.is_valid(raise_exception=True)
            asset = AudioAsset.objects.create(
                material=material,
                file=upload,
                duration_ms=duration,
                mime_type=mime,
                size=upload.size,
            )
            questions = save_question_set(material, validator.validated_data, user)
            publish_question_set(material, user, True)
            AuditLog.objects.create(
                actor=user,
                material=material,
                action="mock.audio_import",
                details={
                    "source_id": source_id,
                    "audio": asset.pk,
                    "question_set": questions.pk,
                    "previous_question_set": paper.pk,
                },
            )
            return questions, True
    except Exception:
        if asset and asset.file:
            asset.file.delete(save=False)
        raise
