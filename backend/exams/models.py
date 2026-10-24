import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


def document_path(instance, filename):
    return f"question-documents/{uuid.uuid4().hex}.pdf"


class QuestionDocument(models.Model):
    material = models.ForeignKey(
        "learning.Material", on_delete=models.PROTECT, related_name="question_documents"
    )
    file = models.FileField(upload_to=document_path)
    extracted_text = models.TextField(blank=True)
    page_count = models.PositiveSmallIntegerField()
    extraction_state = models.CharField(max_length=20, default="extracted")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]


class QuestionSet(models.Model):
    material = models.ForeignKey(
        "learning.Material", on_delete=models.PROTECT, related_name="question_sets"
    )
    audio = models.ForeignKey("learning.AudioAsset", on_delete=models.PROTECT)
    document = models.ForeignKey(
        QuestionDocument, null=True, blank=True, on_delete=models.PROTECT
    )
    document_pages = models.JSONField(default=list)
    sections = models.JSONField(default=list)
    presentation = models.CharField(
        max_length=16,
        choices=[
            ("text", "Interactive text"),
            ("html", "Native formatted question paper"),
            ("pdf", "Original PDF with answer fields"),
            ("legacy_pdf", "Legacy PDF"),
        ],
        default="text",
    )
    duration_seconds = models.PositiveIntegerField(default=1800)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]


class Question(models.Model):
    class Kind(models.TextChoices):
        MULTIPLE_CHOICE = "multiple_choice", "Multiple choice"
        MATCHING = "matching", "Matching"
        FORM = "form_completion", "Form completion"
        NOTE = "note_completion", "Note completion"
        TABLE = "table_completion", "Table completion"
        SENTENCE = "sentence_completion", "Sentence completion"
        SHORT = "short_answer", "Short answer"
        MAP = "map_label", "Map labelling"
        DIAGRAM = "diagram_label", "Diagram labelling"

    question_set = models.ForeignKey(
        QuestionSet, on_delete=models.PROTECT, related_name="questions"
    )
    number = models.PositiveSmallIntegerField()
    part = models.PositiveSmallIntegerField(default=1)
    type = models.CharField(max_length=30, choices=Kind.choices)
    prompt = models.TextField()
    instructions = models.CharField(max_length=500, blank=True)
    max_words = models.PositiveSmallIntegerField(default=3)
    context = models.JSONField(default=dict)

    class Meta:
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(
                fields=["question_set", "number"], name="unique_question_number"
            ),
            models.CheckConstraint(
                condition=Q(part__gte=1, part__lte=4), name="question_part_range"
            ),
        ]


class QuestionOption(models.Model):
    question = models.ForeignKey(
        Question, on_delete=models.PROTECT, related_name="options"
    )
    key = models.CharField(max_length=8)
    text = models.CharField(max_length=1000)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["question", "key"], name="unique_option_key"
            )
        ]


class AnswerKey(models.Model):
    question = models.OneToOneField(
        Question, on_delete=models.PROTECT, related_name="answer_key"
    )
    accepted_answers = models.JSONField(default=list)


class MockAttempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    material = models.ForeignKey("learning.Material", on_delete=models.PROTECT)
    version = models.ForeignKey("learning.TranscriptVersion", on_delete=models.PROTECT)
    question_set = models.ForeignKey(QuestionSet, on_delete=models.PROTECT)
    timing = models.CharField(
        max_length=8, choices=[("timed", "Timed"), ("untimed", "Untimed")]
    )
    started_at = models.DateTimeField(auto_now_add=True)
    deadline = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    answers = models.JSONField(default=dict)
    score = models.PositiveSmallIntegerField(null=True, blank=True)
    total = models.PositiveSmallIntegerField(default=0)
    audio_ticket_hash = models.CharField(max_length=64, blank=True)
    audio_ticket_expires = models.DateTimeField(null=True, blank=True)
    audio_started_at = models.DateTimeField(null=True, blank=True)
    audio_consumed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-started_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(timing="untimed", deadline__isnull=True)
                    | Q(timing="timed", deadline__isnull=False)
                ),
                name="mock_timing_deadline",
            ),
            models.UniqueConstraint(
                fields=["user", "material"],
                condition=Q(submitted_at__isnull=True),
                name="one_active_mock_per_material",
            ),
        ]
