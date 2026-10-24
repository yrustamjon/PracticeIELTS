# Deployment notes

This repository is a development-ready initial increment, not a claim of production deployment.

Before production: run Django via a production WSGI/ASGI server behind TLS; build the frontend and serve its dist assets with an API reverse proxy; set DEBUG=false, DJANGO_SECRET_KEY, ALLOWED_HOSTS and CSRF_TRUSTED_ORIGINS. Never use runserver publicly. Run manage.py check --deploy and review each warning in the deployment context. Add process supervision and health checks, a shared Redis Django cache for distributed throttling, and structured log/error monitoring. Do not log authorization headers, answer contents or secrets.

Use managed PostgreSQL with backups and restore tests, Redis restricted to workers, private S3-compatible media with bucket public access blocked, least-privilege credentials, retention and object lifecycle rules. Validate an actual upload/playback/Range request against the selected object store before enabling it. Storage provider smoke tests and production WSGI packaging remain outstanding.

Run migrations as a one-off release job and collectstatic. Maintain database/media backups together; transcript versions and historical responses must not be rewritten. Keep generated local .env, media and development secrets out of images/version control. No default administrator password; provision staff explicitly through createsuperuser.

Run the real Celery worker separately (one speech job per worker process, bounded CPU threads). Prepare the pinned speech model and verify an original audio-only upload before release. Keep HF model caches on persistent storage. The current reference alignment uses recognized word anchors with explicit uncertainty; phoneme forced alignment is still pending. Do not publish unreviewed generated transcripts. No paid transcription API or Telegram credentials are needed for the local speech workflow.

Question PDFs remain private; render approved student pages as PNGs so PDF scripts are never executed in the app. Teachers must exclude answer-key pages. Text extraction is staff-only and is not automatic OCR or reliable arbitrary question parsing. Preserve question sets as immutable published snapshots.

Timed attempts use server deadlines, while untimed attempts have no expiry. Single-use audio tickets and study-route restrictions enforce normal exam behavior; they do not prevent a determined browser client from retaining received bytes. Add monitoring for stale jobs/worker loss and agree a policy for interrupted exams before public operation.

Content and security work still required before a public release: audit exports/role-management UI, advanced resource quotas, file quarantine/scanning policy, user data export/deletion procedures, accessibility audit, broad mobile/browser coverage, provider-specific S3 tests, and a production operations review.
