from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from .models import ReadingFullAttempt


def timed_full_attempts(user):
    return ReadingFullAttempt.objects.filter(
        user=user, timed=True, submitted_at__isnull=True, deadline__gt=timezone.now()
    )


def require_reading_study(user, paper):
    if (
        timed_full_attempts(user)
        .filter(owner_id=paper.owner_id, book=paper.book, test=paper.test)
        .exists()
    ):
        raise PermissionDenied(
            "Finish your timed Full Reading Mock before opening this test's practice or results."
        )
