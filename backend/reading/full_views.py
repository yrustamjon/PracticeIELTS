from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .access import timed_full_attempts
from .models import ReadingFullAttempt, ReadingPaper
from .serializers import AnswersInput, FullStartInput
from .views import figure_response, questions, score_version, version_data


def versions(attempt):
    return [attempt.version_one, attempt.version_two, attempt.version_three]


def all_questions(attempt):
    return {
        n: (q, g, v) for v in versions(attempt) for n, (q, g) in questions(v).items()
    }


def finalize(attempt):
    if attempt.submitted_at:
        return
    attempt.results = [
        result
        for version in versions(attempt)
        for result in score_version(version, attempt.answers)
    ]
    attempt.score = sum(r["correct"] for r in attempt.results)
    now = timezone.now()
    attempt.submitted_at = min(attempt.deadline, now) if attempt.timed else now
    attempt.save(update_fields=["results", "score", "submitted_at", "updated_at"])


def expire(attempt):
    if (
        not attempt.submitted_at
        and attempt.timed
        and attempt.deadline <= timezone.now()
    ):
        finalize(attempt)


def data(attempt):
    pinned = versions(attempt)
    # The aggregate supplies the existing learner autosave/recovery number index;
    # each passage retains its own content and immutable version ID.
    content = dict(pinned[0].content)
    content.update(
        title="Full Reading Mock",
        groups=[g for v in pinned for g in v.content["groups"]],
    )
    result = {
        "id": attempt.pk,
        "paper": pinned[0].paper_id,
        "book": attempt.book,
        "test": attempt.test,
        "passage": 0,
        "version": {
            "id": pinned[0].pk,
            "content": content,
            "published_at": pinned[0].published_at,
        },
        "passages": [
            {"passage": i + 1, "version": version_data(v)} for i, v in enumerate(pinned)
        ],
        "answers": attempt.answers,
        "timed": attempt.timed,
        "deadline": attempt.deadline,
        "server_time": timezone.now(),
        "submitted_at": attempt.submitted_at,
        "score": attempt.score,
        "total": 40,
    }
    if attempt.submitted_at:
        result["results"] = attempt.results
    return result


class ReadingFullAttemptViewSet(viewsets.GenericViewSet):
    serializer_class = AnswersInput

    @action(detail=True, methods=["get", "post", "delete"])
    @transaction.atomic
    def share(self, request, pk=None):
        from .sharing import share_response

        return share_response(request, self.owned(pk), full=True)

    @transaction.atomic
    def list(self, request):
        # Finalize elapsed exams before describing resumable work. Never return
        # answers, passage content or keys in catalogue/history summaries.
        for attempt in self.get_queryset().select_for_update().filter(
            submitted_at__isnull=True, timed=True, deadline__lte=timezone.now()
        ):
            expire(attempt)
        queryset = self.get_queryset()
        for active in timed_full_attempts(request.user):
            queryset = queryset.exclude(
                owner_id=active.owner_id, book=active.book, test=active.test,
                submitted_at__isnull=False,
            ).exclude(
                owner_id=active.owner_id, book=active.book, test=active.test,
                timed=False,
            )
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response([
            {
                "id": a.pk, "paper": a.version_one.paper_id,
                "book": a.book, "test": a.test, "passage": 0,
                "title": "Full Reading Mock", "timed": a.timed,
                "score": a.score, "total": 40,
                "submitted_at": a.submitted_at, "created_at": a.created_at,
            }
            for a in page
        ])

    def get_queryset(self):
        return ReadingFullAttempt.objects.filter(user=self.request.user).select_related(
            "version_one", "version_two", "version_three"
        )

    def owned(self, pk):
        attempt = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
        if (
            timed_full_attempts(self.request.user)
            .exclude(pk=attempt.pk)
            .filter(owner_id=attempt.owner_id, book=attempt.book, test=attempt.test)
            .exists()
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "Finish your timed Full Reading Mock before opening this test's practice or results."
            )
        expire(attempt)
        return attempt

    @transaction.atomic
    def create(self, request):
        validator = FullStartInput(data=request.data)
        validator.is_valid(raise_exception=True)
        paper = get_object_or_404(
            ReadingPaper,
            pk=validator.validated_data["paper"],
            published_version__isnull=False,
        )
        # Lock the first passage in consistent order for concurrent starts from any passage.
        papers = list(
            ReadingPaper.objects.select_for_update(of=("self",))
            .filter(owner_id=paper.owner_id, book=paper.book, test=paper.test)
            .select_related("published_version")
            .order_by("passage")
        )
        if (
            len(papers) != 3
            or [p.passage for p in papers] != [1, 2, 3]
            or any(not p.published_version_id for p in papers)
        ):
            raise ValidationError(
                "All three reviewed passages must be published before starting a Full Reading Mock."
            )
        numbers = [int(n) for p in papers for n in questions(p.published_version)]
        if numbers != list(range(1, 41)):
            raise ValidationError(
                "The three passages must cover questions 1–40 exactly in order."
            )
        timed = validator.validated_data["timed"]
        identity = dict(
            user=request.user,
            owner_id=paper.owner_id,
            book=paper.book,
            test=paper.test,
            timed=timed,
        )
        attempt = (
            self.get_queryset()
            .select_for_update()
            .filter(**identity, submitted_at__isnull=True)
            .first()
        )
        if attempt:
            expire(attempt)
            if not attempt.submitted_at:
                return Response(data(self.owned(attempt.pk)))
        if (
            not timed
            and timed_full_attempts(request.user)
            .filter(owner_id=paper.owner_id, book=paper.book, test=paper.test)
            .exists()
        ):
            raise ValidationError("Finish the timed Full Reading Mock first.")
        attempt = ReadingFullAttempt.objects.create(
            **identity,
            version_one=papers[0].published_version,
            version_two=papers[1].published_version,
            version_three=papers[2].published_version,
            deadline=timezone.now() + timedelta(minutes=60) if timed else None,
        )
        return Response(data(attempt), status=201)

    @transaction.atomic
    def retrieve(self, request, pk=None):
        return Response(data(self.owned(pk)))

    @action(
        detail=True,
        methods=["get"],
        url_path=r"figures/(?P<passage>[1-3])/(?P<index>\d+)",
    )
    @transaction.atomic
    def figure(self, request, pk=None, passage=None, index=None):
        attempt = self.owned(pk)
        return figure_response(versions(attempt)[int(passage) - 1], index)

    @transaction.atomic
    def partial_update(self, request, pk=None):
        attempt = self.owned(pk)
        if attempt.submitted_at:
            # Returning instead of raising preserves deadline finalization.
            return Response(
                {
                    "detail": "Submitted or expired answers cannot be changed.",
                    "attempt": data(attempt),
                },
                status=400,
            )
        validator = AnswersInput(data=request.data)
        validator.is_valid(raise_exception=True)
        answers = validator.validated_data["answers"]
        allowed = all_questions(attempt)
        if set(answers) - set(allowed):
            raise ValidationError("Unknown question number.")
        for number, answer in answers.items():
            _, group, _ = allowed[number]
            choices = {
                "true_false": ["TRUE", "FALSE", "NOT GIVEN"],
                "yes_no": ["YES", "NO", "NOT GIVEN"],
            }.get(
                group["kind"],
                group["options"]
                if group["kind"]
                in {"choice", "multiple_choice", "headings", "matching", "completion"}
                else None,
            )
            if answer and choices and answer not in choices:
                raise ValidationError("Choose one of the supplied options.")
        attempt.answers |= answers
        attempt.save(update_fields=["answers", "updated_at"])
        return Response(data(attempt))

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def submit(self, request, pk=None):
        attempt = self.owned(pk)
        finalize(attempt)
        return Response(data(attempt))
