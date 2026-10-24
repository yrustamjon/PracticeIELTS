from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from accounts.views import (
    CsrfView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    RegisterView,
)
from exams.views import (
    AttemptDocumentPage,
    AttemptPdfPage,
    MockAttemptViewSet,
    TeacherDocumentPage,
    TeacherPdfPage,
)
from learning.views import (
    AudioStream,
    CategoryViewSet,
    MaterialViewSet,
    ProgressView,
    ResponseView,
    SessionViewSet,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet)
router.register("materials", MaterialViewSet, basename="material")
router.register("sessions", SessionViewSet, basename="session")
router.register("mock-attempts", MockAttemptViewSet, basename="mock-attempt")
urlpatterns = [
    path(
        "api/v1/question-documents/<int:pk>/pdf-pages/<int:page>/",
        TeacherPdfPage.as_view(),
    ),
    path(
        "api/v1/mock-attempts/<int:pk>/pdf-pages/<int:page>/", AttemptPdfPage.as_view()
    ),
    path(
        "api/v1/question-documents/<int:pk>/pages/<int:page>/",
        TeacherDocumentPage.as_view(),
    ),
    path(
        "api/v1/mock-attempts/<int:pk>/document-pages/<int:page>/",
        AttemptDocumentPage.as_view(),
    ),
    path("django-admin/", admin.site.urls),
    path("api/v1/", include(router.urls)),
    path("api/v1/auth/csrf/", CsrfView.as_view()),
    path("api/v1/auth/register/", RegisterView.as_view()),
    path("api/v1/auth/login/", LoginView.as_view()),
    path("api/v1/auth/refresh/", RefreshView.as_view()),
    path("api/v1/auth/logout/", LogoutView.as_view()),
    path("api/v1/auth/me/", MeView.as_view()),
    path("api/v1/audio/<int:pk>/stream/", AudioStream.as_view()),
    path("api/v1/progress/", ProgressView.as_view()),
    path("api/v1/responses/", ResponseView.as_view()),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
]
