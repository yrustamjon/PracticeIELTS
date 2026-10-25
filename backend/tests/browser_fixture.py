"""Create/remove only the exact disposable identities supplied by the browser test."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()
from django.db import transaction

from accounts.models import User
from exams.models import (
    AnswerKey,
    MockAttempt,
    Question,
    QuestionDocument,
    QuestionOption,
    QuestionSet,
)
from learning.models import (
    AudioAsset,
    AuditLog,
    Category,
    ListeningTest,
    Material,
    PracticeSession,
    Segment,
    TestPart,
    TranscriptVersion,
)
from processing.models import ProcessingJob

teacher = os.environ["TEST_TEACHER"]
student = os.environ["TEST_STUDENT"]
if not teacher.startswith("teacher_") or not student.startswith("student_"):
    raise RuntimeError("Expected disposable test identities")
if sys.argv[1] == "create":
    User.objects.create_user(
        username=teacher, password=os.environ["TEST_PASSWORD"], role="teacher"
    )
    User.objects.create_user(username=student, password=os.environ["TEST_PASSWORD"])
elif sys.argv[1] == "seed_manual":
    # Explicitly authored test fixture, not a simulated speech-provider output.
    material = Material.objects.get(
        pk=int(os.environ["TEST_MATERIAL_ID"]), owner__username=teacher
    )
    latest = material.processing_jobs.first()
    if latest and latest.state in ("queued", "running"):
        raise RuntimeError(
            "Wait for the real processing outcome before adding the manual test fixture"
        )
    audio = material.audio_assets.order_by("-id").first()
    version = TranscriptVersion.objects.create(
        material=material, audio=audio, origin="manual"
    )
    Segment.objects.create(
        version=version,
        position=0,
        text="Welcome to our library.",
        start_ms=0,
        end_ms=1700,
    )
    Segment.objects.create(
        version=version,
        position=1,
        text="The books are upstairs.",
        start_ms=1700,
        end_ms=2800,
    )
elif sys.argv[1] == "expire_exam":
    from datetime import timedelta

    from django.utils import timezone

    attempt = MockAttempt.objects.get(
        pk=int(os.environ["TEST_ATTEMPT_ID"]),
        user__username=student,
        timing="timed",
        submitted_at__isnull=True,
    )
    attempt.deadline = timezone.now() - timedelta(seconds=1)
    attempt.save(update_fields=["deadline"])
elif sys.argv[1] == "create_pdf":
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    for text in [
        "Original question paper: 1. The books are ____. 2. Choose the level: A Upstairs, B Downstairs.",
        "Private answer key: 1 upstairs, 2 A",
    ]:
        page = writer.add_blank_page(600, 800)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): writer._add_object(font)}
                )
            }
        )
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 30 750 Td ({text}) Tj ET".encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    with open(os.environ["TEST_QUESTION_PDF"], "wb") as target:
        writer.write(target)
elif sys.argv[1] == "create_layout_pdf":
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    content = [
        [
            (40, 750, 22, "Community Workshop"),
            (40, 715, 16, "Registration details"),
            (40, 680, 12, "Write ONE WORD AND/OR A NUMBER for each answer."),
            (40, 630, 14, "Name: 1 ........................"),
            (40, 590, 14, "Day: 2 ........................"),
            (40, 550, 14, "City: 3 ........................"),
            (40, 510, 14, "Email: 4 ........................"),
            (40, 470, 14, "Phone: 5 ........................"),
            (40, 420, 12, "Please arrive ten minutes early."),
        ],
        [
            (40, 750, 22, "Workshop schedule"),
            (40, 710, 12, "Complete the table below."),
            (55, 650, 14, "Detail"),
            (260, 650, 14, "Your answer"),
            (55, 610, 14, "Room"),
            (260, 610, 14, "6 ........................"),
            (55, 570, 14, "Time"),
            (260, 570, 14, "7 ........................"),
            (55, 530, 14, "Level"),
            (260, 530, 14, "8 ........................"),
            (55, 490, 14, "Fee"),
            (260, 490, 14, "9 ........................"),
            (55, 450, 14, "Teacher"),
            (260, 450, 14, "10 ........................"),
            (40, 380, 12, "Bring your notebook and a pencil."),
        ],
        [
            (40, 750, 18, "Private answer key - never show to students"),
            (
                40,
                700,
                14,
                "1 Alex 2 Monday 3 York 4 mail 5 123 6 blue 7 nine 8 basic 9 ten 10 Sam",
            ),
        ],
    ]
    for n, lines in enumerate(content):
        page = writer.add_blank_page(600, 800)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): writer._add_object(font)}
                )
            }
        )
        commands = []
        for x, y, size, text in lines:
            commands.append(f"BT /F1 {size} Tf {x} {y} Td ({text}) Tj ET")
        if n == 1:
            commands.append("q 0.5 w 40 430 500 250 re S 240 430 m 240 680 l S Q")
            for y in range(440, 641, 40):
                commands.append(f"40 {y} m 540 {y} l S")
        stream = DecodedStreamObject()
        stream.set_data("\n".join(commands).encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    with open(os.environ["TEST_QUESTION_PDF"], "wb") as target:
        writer.write(target)
elif sys.argv[1] in ("create_text_mock", "create_compact_mock"):
    # Explicitly authored original 40-question fixture for navigation/layout,
    # separate from the upload/ASR acceptance tests.
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.utils import timezone

    from exams.serializers import QuestionSetInput
    from exams.services import save_question_set
    from learning.services.audio import inspect_audio

    owner = User.objects.get(username=teacher)
    collection = Category.objects.create(
        name="Full Mock " + teacher.removeprefix("teacher_")
    )
    material = Material.objects.create(
        owner=owner,
        category=collection,
        title="Original four-part mock",
        source="Original browser fixture",
        license="CC0",
        rights_confirmed=True,
    )
    upload = SimpleUploadedFile(
        "original-speech.wav", Path(os.environ["TEST_RECORDING"]).read_bytes()
    )
    duration, mime = inspect_audio(upload)
    audio = AudioAsset.objects.create(
        material=material,
        file=upload,
        duration_ms=duration,
        mime_type=mime,
        size=upload.size,
    )
    version = TranscriptVersion.objects.create(
        material=material, audio=audio, origin="manual", published_at=timezone.now()
    )
    Segment.objects.create(
        version=version,
        position=0,
        text="Welcome to our library. The books are upstairs.",
        start_ms=0,
        end_ms=duration,
    )
    questions = []
    kinds = [
        "sentence_completion",
        "multiple_choice",
        "matching",
        "form_completion",
        "note_completion",
        "table_completion",
        "short_answer",
        "map_label",
        "diagram_label",
    ]
    compact = sys.argv[1] == "create_compact_mock"
    for number in range(1, 11 if compact else 41):
        kind = "short_answer" if compact else kinds[(number - 1) % len(kinds)]
        q = {
            "number": number,
            "part": (number - 1) // 10 + 1,
            "type": kind,
            "prompt": "The books are ____."
            if kind != "table_completion"
            else "Complete the location table.",
            "instructions": "ONE WORD",
            "options": [],
            "answers": ["upstairs"],
            "max_words": 1,
            "context": {},
        }
        if compact:
            prompts = [
                "Address: 18, ____ Street",
                "Heard about the workshop from: ____",
                "- Morning session: outdoor ____",
                "- Afternoon session: stay near the ____",
                "Meeting location: ____",
                "Bring a ____",
                "Travel by ____",
                "Booking contact: ____",
                "Group leader: ____",
                "Final destination: ____",
            ]
            q.update(
                prompt=prompts[number - 1],
                instructions="Write ONE WORD ONLY for each answer.",
                answers=["station"],
            )
        if kind in ("multiple_choice", "matching"):
            q.update(
                prompt="Choose the location of the books.",
                instructions="Choose one answer.",
                options=[
                    {"key": "A", "text": "Upstairs"},
                    {"key": "B", "text": "Downstairs"},
                ],
                answers=["A"],
            )
        if kind == "table_completion":
            q["context"] = {"table": [["Item", "Location"], ["Books", "____"]]}
        if kind in ("map_label", "diagram_label"):
            q["context"] = {
                "body": "The entrance opens into the ground-floor lobby. Stairs lead to the upper floor, where all books are kept."
            }
        questions.append(q)
    serializer = QuestionSetInput(
        data={"questions": questions, "presentation": "text", "duration_seconds": 1800}
    )
    serializer.is_valid(raise_exception=True)
    qs = save_question_set(material, serializer.validated_data, owner)
    qs.published_at = timezone.now()
    qs.save(update_fields=["published_at"])
    material.published_version = version
    material.published_questions = qs
    material.save(update_fields=["published_version", "published_questions"])
    print(material.pk)
elif sys.argv[1] == "create_long_practice":
    import io
    import wave

    from django.core.files.base import ContentFile
    from django.utils import timezone

    # Repeated original speech, with offsets measured from actual PCM frame counts.
    with wave.open(os.environ["TEST_RECORDING"], "rb") as source:
        params = source.getparams()
        frames = source.readframes(source.getnframes())
        count = source.getnframes()
        rate = source.getframerate()
    output = io.BytesIO()
    with wave.open(output, "wb") as target:
        target.setparams(params)
        for _ in range(30):
            target.writeframes(frames)
    owner = User.objects.get(username=teacher)
    category, _ = Category.objects.get_or_create(
        name="Auto Speech " + teacher.removeprefix("teacher_")
    )
    material = Material.objects.create(
        title="Original repeated speech " + teacher.removeprefix("teacher_"),
        category=category,
        owner=owner,
        source="Original synthesized speech",
        license="Original fixture permission",
        rights_confirmed=True,
    )
    audio = AudioAsset.objects.create(
        material=material,
        file=ContentFile(output.getvalue(), name="original-repeated.wav"),
        duration_ms=round(count * 30 * 1000 / rate),
        mime_type="audio/wav",
        size=len(output.getvalue()),
    )
    version = TranscriptVersion.objects.create(
        material=material, audio=audio, published_at=timezone.now()
    )
    Segment.objects.bulk_create(
        [
            Segment(
                version=version,
                position=i,
                text="Welcome to our library. The books are upstairs.",
                start_ms=round(i * count * 1000 / rate),
                end_ms=round((i + 1) * count * 1000 / rate),
            )
            for i in range(30)
        ]
    )
    material.published_version = version
    material.save()
    print(material.pk)
elif sys.argv[1] == "cleanup":
    with transaction.atomic():
        users = User.objects.filter(username__in=[teacher, student])
        materials = Material.objects.filter(owner__in=users)
        TestPart.objects.filter(test__owner__in=users).delete()
        ListeningTest.objects.filter(owner__in=users).delete()
        MockAttempt.objects.filter(material__in=materials).delete()
        PracticeSession.objects.filter(user__in=users).delete()
        materials.update(published_version=None, published_questions=None)
        ProcessingJob.objects.filter(material__in=materials).delete()
        AnswerKey.objects.filter(
            question__question_set__material__in=materials
        ).delete()
        QuestionOption.objects.filter(
            question__question_set__material__in=materials
        ).delete()
        Question.objects.filter(question_set__material__in=materials).delete()
        QuestionSet.objects.filter(material__in=materials).delete()
        for document in QuestionDocument.objects.filter(material__in=materials):
            document.file.delete(save=False)
            document.delete()
        Segment.objects.filter(version__material__in=materials).delete()
        TranscriptVersion.objects.filter(material__in=materials).delete()
        for asset in AudioAsset.objects.filter(material__in=materials):
            asset.file.delete(save=False)
            asset.delete()
        AuditLog.objects.filter(actor__in=users).delete()
        materials.delete()
        Category.objects.filter(
            name__in=[
                "Everyday English " + teacher.removeprefix("teacher_"),
                "Auto Speech " + teacher.removeprefix("teacher_"),
                "Full Mock " + teacher.removeprefix("teacher_"),
            ]
        ).delete()
        Category.objects.filter(
            name="Review book " + teacher.removeprefix("teacher_")
        ).delete()
        Category.objects.filter(
            name="Review collection " + teacher.removeprefix("teacher_")
        ).delete()
        users.delete()
else:
    raise RuntimeError("Expected create or cleanup")
