"""Import a private reviewed JSON transcription with its original PDF; never publish."""

import json
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from reading.models import ReadingPaper
from reading.serializers import PaperInput, VersionInput
from reading.views import save_version


class Command(BaseCommand):
    help = "Create an append-only private Reading draft from JSON and a source PDF. Does not publish."

    def add_arguments(self, parser):
        parser.add_argument("--json", required=True)
        parser.add_argument("--pdf", required=True)
        parser.add_argument("--owner", required=True)
        parser.add_argument("--book", required=True)
        parser.add_argument("--test", type=int, required=True)
        parser.add_argument("--passage", type=int, required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        user = User.objects.get(username=options["owner"])
        if not user.can_edit:
            raise CommandError("Owner must be an authorized editor.")
        payload = json.loads(Path(options["json"]).read_text())
        validator = VersionInput(data=payload)
        validator.is_valid(raise_exception=True)
        identity = PaperInput(data={k: options[k] for k in ["book", "test", "passage"]})
        identity.is_valid(raise_exception=True)
        paper, _ = ReadingPaper.objects.get_or_create(
            owner=user, **identity.validated_data
        )
        last = paper.versions.first()
        if last and all(
            getattr(last, k) == v for k, v in validator.validated_data.items()
        ):
            self.stdout.write(
                f"Unchanged private draft: paper={paper.pk}, version={last.pk}"
            )
            return
        with Path(options["pdf"]).open("rb") as source:
            file = File(source, name="source.pdf")
            file.size = Path(options["pdf"]).stat().st_size

            class Request:
                data = payload
                FILES = {"source": file}

            version = save_version(Request(), paper)
        self.stdout.write(
            f"Private draft saved: paper={paper.pk}, version={version.pk}. Not published."
        )
