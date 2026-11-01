"""Native exam audio authorization, accepted only by the audio action."""

from django.core import signing
from django.contrib.auth import get_user_model
from django.utils.crypto import constant_time_compare
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

COOKIE = "exam_audio"
SALT = "practiceielts.exam-audio.v1"


class ExamAudioAuthentication(JWTAuthentication):
    def authenticate(self, request):
        if self.get_header(request) is not None:
            return super().authenticate(request)
        value = request.COOKIES.get(COOKIE)
        if not value:
            return None
        try:
            data = signing.loads(value, salt=SALT, max_age=86400)
            user = get_user_model().objects.get(pk=data["user"], is_active=True)
            if str(data["attempt"]) != str(
                request.parser_context["kwargs"]["pk"]
            ) or not constant_time_compare(
                data["session"], user.get_session_auth_hash()
            ):
                raise AuthenticationFailed("Invalid exam audio authorization.")
        except (signing.BadSignature, KeyError, get_user_model().DoesNotExist):
            raise AuthenticationFailed("Exam audio authorization expired.")
        return user, data["ticket"]
