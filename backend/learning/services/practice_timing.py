"""Administrator corrections of Easy playback windows with pinned history."""

from django.db import transaction
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from learning.models import AuditLog, Material, PracticeSession, PracticeTimingRevision
from learning.services.comparison import groups


class TimingConflict(APIException):
    status_code = 409
    default_code = "stale_practice_timing"


def can_edit_timing(session):
    user = session.user
    return (
        user.is_active
        and (user.is_staff or user.role == "admin")
        and session.difficulty == "easy"
        and session.version_id == session.material.published_version_id
    )


def latest_timing_revision(version_id, grouping_version):
    return PracticeTimingRevision.objects.filter(
        version_id=version_id, grouping_version=grouping_version
    ).first()


@transaction.atomic
def save_timing(session, actor, data):
    if not actor.is_active or not (actor.is_staff or actor.role == "admin"):
        raise PermissionDenied("Only administrators can correct Practice timing.")
    if session.difficulty != "easy":
        raise ValidationError(
            {"detail": "Timing corrections are available only in Easy mode."}
        )
    material = Material.objects.select_for_update().get(pk=session.material_id)
    session = (
        PracticeSession.objects.select_for_update(of=("self",))
        .select_related("version__audio", "timing_revision", "material", "user")
        .get(pk=session.pk, user=actor)
    )
    if material.published_version_id != session.version_id:
        raise TimingConflict(
            "A newer transcript is published. Reopen the latest Easy Practice from the material."
        )
    latest = latest_timing_revision(session.version_id, session.grouping_version)
    latest_id = latest.pk if latest else None
    if (
        data["revision"] != session.timing_revision_id
        or latest_id != session.timing_revision_id
    ):
        raise TimingConflict(
            "Timing has changed. Reopen the latest Easy Practice from the material before saving."
        )
    intervals = groups(session)
    position, start, end = data["position"], data["start_ms"], data["end_ms"]
    if position >= len(intervals):
        raise ValidationError({"position": "Choose an existing exercise."})
    if end <= start:
        raise ValidationError({"end_ms": "End time must be later than start time."})
    if end > session.version.audio.duration_ms:
        raise ValidationError(
            {"end_ms": "End time exceeds the original audio duration."}
        )
    if position and start < intervals[position - 1]["end_ms"]:
        raise ValidationError(
            {
                "start_ms": "Start time overlaps the previous exercise. Adjust that exercise first."
            }
        )
    if position + 1 < len(intervals) and end > intervals[position + 1]["start_ms"]:
        raise ValidationError(
            {
                "end_ms": "End time overlaps the next exercise. Adjust that exercise first."
            }
        )
    current = intervals[position]
    if current["start_ms"] == start and current["end_ms"] == end:
        return session
    overrides = dict(latest.overrides) if latest else {}
    overrides[str(position)] = {"start_ms": start, "end_ms": end}
    revision = PracticeTimingRevision.objects.create(
        version=session.version,
        grouping_version=session.grouping_version,
        overrides=overrides,
        created_by=actor,
    )
    session.timing_revision = revision
    session.save(update_fields=["timing_revision", "updated_at"])
    AuditLog.objects.create(actor=actor, material=material, action="practice.timing")
    return session
