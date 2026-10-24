import os
from datetime import timedelta
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
from urllib.parse import quote

from dotenv import load_dotenv

load_dotenv(BASE_DIR.parent / ".env", override=False)
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("DJANGO_SECRET_KEY is required outside development")
    secret_path = BASE_DIR / ".venv" / ".development-secret"
    secret_path.parent.mkdir(parents=True, exist_ok=True)
    if not secret_path.exists():
        import secrets

        secret_path.write_text(secrets.token_urlsafe(64))
        secret_path.chmod(0o600)
    SECRET_KEY = secret_path.read_text()
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",")
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "accounts",
    "learning",
    "processing",
    "exams",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

USE_SQLITE = os.getenv("USE_SQLITE", "false").lower() in (
    "true", "1", "yes"
)

if USE_SQLITE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    database_url = os.getenv("DATABASE_URL")

    if not database_url and os.getenv("POSTGRES_PASSWORD"):
        database_url = (
            "postgresql://practiceielts:"
            + quote(os.environ["POSTGRES_PASSWORD"], safe="")
            + "@127.0.0.1:5432/practiceielts"
        )

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL or POSTGRES_PASSWORD is required "
            "when USE_SQLITE is disabled."
        )

    DATABASES = {
        "default": dj_database_url.parse(
            database_url,
            conn_max_age=60,
        )
    }


AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication"
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "2000/hour",
        "login": "20/hour",
    },
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=10),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
SPECTACULAR_SETTINGS = {
    "TITLE": "PracticeIELTS API",
    "VERSION": "1.0.0",
    "COMPONENT_SPLIT_REQUEST": True,
}
CSRF_TRUSTED_ORIGINS = os.getenv(
    "CSRF_TRUSTED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
DATA_UPLOAD_MAX_MEMORY_SIZE = 110 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
if os.getenv("S3_BUCKET"):
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": os.environ["S3_BUCKET"],
                "endpoint_url": os.getenv("S3_ENDPOINT_URL"),
                "default_acl": None,
                "querystring_auth": True,
                "file_overwrite": False,
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }

# Local CPU speech recognition; first use downloads a public model unless local-only is enabled.
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base.en")
WHISPER_CACHE_DIR = Path(
    os.getenv("WHISPER_CACHE_DIR", str(BASE_DIR / ".cache" / "whisper"))
)
WHISPER_THREADS = max(1, min(int(os.getenv("WHISPER_THREADS", "4")), 8))
WHISPER_LOCAL_ONLY = os.getenv("WHISPER_LOCAL_ONLY", "false").lower() == "true"
CELERY_TASK_PUBLISH_RETRY = False
CELERY_BROKER_CONNECTION_TIMEOUT = 3
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_TRACK_STARTED = True

# Keep model caches in the checkout's ignored writable cache, including HF/Xet metadata.
os.environ.setdefault("HF_HOME", str(WHISPER_CACHE_DIR / "hub-home"))
os.environ.setdefault("HF_XET_CACHE", str(WHISPER_CACHE_DIR / "xet"))

# Use the Hub's supported HTTPS downloader in proxied environments; keep TLS verification enabled.
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

WHISPER_MODEL_REVISION = os.getenv("WHISPER_MODEL_REVISION") or {
    "tiny.en": "0d3d19a32d3338f10357c0889762bd8d64bbdeba",
    "base.en": "3d3d5dee26484f91867d81cb899cfcf72b96be6c",
}.get(WHISPER_MODEL)
