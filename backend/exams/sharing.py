from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from learning.models import ListeningTest, TestPart
from .models import SharedMockResult
from .services import attempt_data


def result_snapshot(attempt):
    data = attempt_data(attempt)
    part = TestPart.objects.select_related('test').filter(material=attempt.material).first()
    test = part.test if part else ListeningTest.objects.filter(full_material=attempt.material).first()
    category = test.category if test else attempt.material.category
    path, seen = [], set()
    while category and category.pk not in seen:
        seen.add(category.pk)
        path.insert(0, category.name)
        category = category.parent
    questions = {q['number']: q for q in data['questions']}
    return {
        'title': data['title'], 'category_path': path,
        'test_title': test.title if test else '',
        'part_label': f'Part {part.number}' if part else ('Full test' if test else ''),
        'timing': data['timing'], 'score': data['score'], 'total': data['total'],
        'submitted_at': attempt.submitted_at.isoformat(),
        'results': [{**r, 'part': questions[r['number']]['part'],
                     'prompt': questions[r['number']]['prompt'],
                     'options': questions[r['number']]['options']}
                    for r in data['results']],
    }


def private_response(data, status=200):
    return Response(data, status=status, headers={
        'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'no-referrer',
    })


class PublicMockResult(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        shared = get_object_or_404(SharedMockResult, token=token)
        return private_response(shared.snapshot)
