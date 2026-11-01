from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from exams.sharing import private_response

from .models import SharedReadingResult


def result_snapshot(attempt, full):
    versions = ([attempt.version_one, attempt.version_two, attempt.version_three]
                if full else [attempt.version])
    questions = {
        q["number"]: (v.paper.passage, q, group)
        for v in versions for group in v.content["groups"]
        for q in group["questions"]
    }
    return {
        "book": attempt.book if full else attempt.paper.book,
        "test": attempt.test if full else attempt.paper.test,
        "passage": 0 if full else attempt.paper.passage,
        "title": "Full Reading Mock" if full else attempt.version.content["title"],
        "timed": attempt.timed if full else False,
        "score": attempt.score, "total": len(questions),
        "submitted_at": attempt.submitted_at.isoformat(),
        "results": [
            {
                "number": row["number"], "answer": row["answer"],
                "correct": row["correct"],
                "accepted_answers": row["accepted_answers"],
                "passage": questions[row["number"]][0],
                "prompt": questions[row["number"]][1].get("prompt", ""),
                "options": [
                    {"key": option, "text": questions[row["number"]][2]
                     .get("option_labels", {}).get(option, "")}
                    for option in questions[row["number"]][2].get("options", [])
                ],
            }
            for row in attempt.results
        ],
    }


def share_response(request, attempt, full=False):
    lookup = {"full_attempt" if full else "attempt": attempt}
    if request.method == "DELETE":
        SharedReadingResult.objects.filter(**lookup).delete()
        return private_response(None, status=204)
    if not attempt.submitted_at:
        raise ValidationError("Submit your Reading answers before sharing results.")
    shared = SharedReadingResult.objects.filter(**lookup).first()
    if request.method == "POST" and shared is None:
        shared = SharedReadingResult.objects.create(
            **lookup, snapshot=result_snapshot(attempt, full),
        )
    return private_response({"token": str(shared.token) if shared else None})


class PublicReadingResult(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        shared = get_object_or_404(SharedReadingResult, token=token)
        return private_response(shared.snapshot)
