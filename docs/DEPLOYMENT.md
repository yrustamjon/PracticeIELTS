# Deployment notes

This repository is a development-ready initial increment, not a claim of production deployment.

Before production: run Django via a production WSGI/ASGI server behind TLS; build the frontend and serve its dist assets with an API reverse proxy; set DEBUG=false, DJANGO_SECRET_KEY, ALLOWED_HOSTS and CSRF_TRUSTED_ORIGINS. Never use runserver publicly. Run manage.py check --deploy and review each warning in the deployment context. Add process supervision and health checks, a shared Redis Django cache for distributed throttling, and structured log/error monitoring. Do not log authorization headers, answer contents or secrets.

Use managed PostgreSQL with backups and restore tests, Redis restricted to workers, private S3-compatible media with bucket public access blocked, least-privilege credentials, retention and object lifecycle rules. Validate an actual upload/playback/Range request against the selected object store before enabling it. Storage provider smoke tests and production WSGI packaging remain outstanding.

Run migrations as a one-off release job and collectstatic. Maintain database/media backups together; transcript versions and historical responses must not be rewritten. Keep generated local .env, media and development secrets out of images/version control. No default administrator password; provision staff explicitly through createsuperuser.

Celery infrastructure starts independently. Automatic transcription/alignment jobs and providers are not implemented yet and must not be advertised as working. Do not publish unreviewed generated transcripts. No Telegram credentials are needed for current features.

Content and security work still required before a public release: audit exports/role-management UI, advanced resource quotas, file quarantine/scanning policy, user data export/deletion procedures, accessibility audit, broad mobile/browser coverage, provider-specific S3 tests, and a production operations review.
