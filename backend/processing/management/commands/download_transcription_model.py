from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Download/verify the public local speech model using normal TLS verification."
    )

    def handle(self, *args, **options):
        from faster_whisper.utils import download_model

        try:
            directory = download_model(
                settings.WHISPER_MODEL,
                cache_dir=str(settings.WHISPER_CACHE_DIR),
                revision=settings.WHISPER_MODEL_REVISION,
            )
        except Exception as exc:
            raise CommandError(
                "The speech model could not be downloaded. Check Hugging Face access and the configured model name."
            ) from exc
        self.stdout.write(self.style.SUCCESS("Speech model ready: " + directory))
