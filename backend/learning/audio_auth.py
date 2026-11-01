"""Short-lived cookie scoped to read-only study audio, not other APIs."""

from django.core import signing
from django.contrib.auth import get_user_model
from django.utils.crypto import constant_time_compare
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from drf_spectacular.extensions import OpenApiAuthenticationExtension

COOKIE = "study_audio"
COOKIE_PATH = "/api/v1/audio/"
SALT = "practiceielts.study-audio.v1"
LIFETIME = 600


class StudyAudioScheme(OpenApiAuthenticationExtension):
    target_class = "learning.audio_auth.StudyAudioAuthentication"
    name = ["studyAudioBearer", "studyAudioCookie"]

    def get_security_requirement(self, auto_schema):
        return [{"studyAudioBearer": []}, {"studyAudioCookie": []}]

    def get_security_definition(self, auto_schema):
        return [
            {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"},
            {"type": "apiKey", "in": "cookie", "name": COOKIE},
        ]


class StudyAudioAuthentication(JWTAuthentication):
    def authenticate(self, request):
        if self.get_header(request) is not None:
            return super().authenticate(request)
        value = request.COOKIES.get(COOKIE)
        if not value:
            return None
        try:
            data = signing.loads(value, salt=SALT, max_age=LIFETIME)
            user = get_user_model().objects.get(pk=data["user"], is_active=True)
            if not constant_time_compare(data["session"], user.get_session_auth_hash()):
                raise AuthenticationFailed("Please sign in again.")
        except (signing.BadSignature, KeyError, get_user_model().DoesNotExist):
            raise AuthenticationFailed("Study audio authorization expired. Retry audio.")
        return user, None
