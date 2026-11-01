from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ListeningTest, SharedPracticeResult, TestPart
from .services.comparison import groups


def share_response(data, status=200):
    return Response(
        data,
        status=status,
        headers={
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
            "Referrer-Policy": "no-referrer",
        },
    )


def practice_snapshot(session):
    intervals = groups(session)
    latest = {}
    first = {}
    attempts = {}
    history = {}
    for response in session.responses.order_by("position", "-created_at", "-id"):
        latest.setdefault(response.position, response)
        history.setdefault(response.position, []).append(response)
        first[response.position] = response
        attempts[response.position] = attempts.get(response.position, 0) + 1
    part = (
        TestPart.objects.select_related("test")
        .filter(material_id=session.material_id)
        .first()
    )
    test = (
        part.test
        if part
        else ListeningTest.objects.filter(full_material_id=session.material_id).first()
    )
    category = test.category if test else session.material.category
    path, seen = [], set()
    while category and category.pk not in seen:
        seen.add(category.pk)
        path.insert(0, category.name)
        category = category.parent
    results = []
    for i, interval in enumerate(intervals):
        checked = latest.get(i)
        if checked is None:
            continue
        result = checked.result
        results.append(
            {
                "number": i + 1,
                "attempt_count": attempts[i],
                "first_accuracy": first[i].result["accuracy"],
                "attempts": [
                    {
                        "number": number,
                        "accuracy": response.result["accuracy"],
                        "mistakes": [
                            {key: token.get(key) for key in ("status", "expected", "actual")}
                            for token in response.result.get("tokens", [])
                            if token.get("status") in ("incorrect", "missing", "extra")
                        ],
                    }
                    for number, response in enumerate(reversed(history[i]), 1)
                ],
                "answer": checked.original_answer,
                "reference": result.get("reference", interval["text"]),
                "accuracy": result["accuracy"],
                "tokens": [
                    {
                        key: token.get(key)
                        for key in ("status", "expected", "actual", "reason")
                    }
                    for token in result.get("tokens", [])
                ],
            }
        )
    return {
        "mode": "dictation",
        "title": session.material.title,
        "category_path": path,
        "test_title": test.title if test else "",
        "part_label": f"Part {part.number}" if part else ("Full test" if test else ""),
        "difficulty": session.difficulty,
        "exercise_count": len(intervals),
        "checked_count": len(results),
        "status": "completed"
        if intervals and len(results) == len(intervals)
        else "in_progress",
        "accuracy": round(sum(row["accuracy"] for row in results) / len(results), 1)
        if results
        else None,
        "completed_at": max(
            latest[i].created_at for i in range(len(intervals)) if i in latest
        ).isoformat()
        if intervals and len(results) == len(intervals)
        else None,
        "shared_at": timezone.now().isoformat(),
        "results": results,
    }


class PublicPracticeResult(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        shared = get_object_or_404(
            SharedPracticeResult.objects.select_related(
                "session__material__category",
                "session__version",
                "session__timing_revision",
            ),
            token=token,
        )
        data = practice_snapshot(shared.session)
        data["shared_at"] = shared.created_at.isoformat()
        return share_response(data)
