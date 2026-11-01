from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from accounts.user_directory import AdminUsersView, AdminUsersOverview
from accounts.management_api import AdminAccountDetailView, AdminAccountsView, AdminActivityView, PasswordChangeView
from accounts.views import (
    CsrfView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    RegisterView,
)
from exams.sharing import PublicMockResult
from exams.views import (
    AttemptDocumentPage,
    AttemptPdfPage,
    MockAttemptViewSet,
    TeacherDocumentPage,
    TeacherPdfPage,
)
from learning.practice_sharing import PublicPracticeResult
from learning.tests_api import ListeningTestViewSet
from learning.views import (
    AudioStream,
    AudioPlayback,
    CategoryViewSet,
    MaterialViewSet,
    ProgressView,
    ResponseView,
    SessionViewSet,
)

from reading.views import ReadingPaperViewSet, ReadingAttemptViewSet
from reading.full_views import ReadingFullAttemptViewSet
from reading.import_views import ReadingImportViewSet
from reading.sharing import PublicReadingResult

router = DefaultRouter()
router.register("reading-imports", ReadingImportViewSet, basename="reading-import")
router.register("reading-papers", ReadingPaperViewSet, basename="reading-paper")
router.register("reading-attempts", ReadingAttemptViewSet, basename="reading-attempt")
router.register("reading-full-attempts", ReadingFullAttemptViewSet, basename="reading-full-attempt")
router.register("listening-tests", ListeningTestViewSet, basename="listening-test")
router.register("categories", CategoryViewSet)
router.register("materials", MaterialViewSet, basename="material")
router.register("sessions", SessionViewSet, basename="session")
router.register("mock-attempts", MockAttemptViewSet, basename="mock-attempt")
urlpatterns = [
    path("api/v1/shared-reading-results/<uuid:token>/", PublicReadingResult.as_view()),
    path("api/v1/shared-practice-results/<uuid:token>/", PublicPracticeResult.as_view()),
    path("api/v1/admin/users/", AdminUsersView.as_view()),
    path("api/v1/admin/users/overview/", AdminUsersOverview.as_view()),
    path("api/v1/shared-results/<uuid:token>/", PublicMockResult.as_view()),
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
    path("api/v1/auth/password/", PasswordChangeView.as_view()),
    path("api/v1/admin/accounts/", AdminAccountsView.as_view()),
    path("api/v1/admin/accounts/<int:pk>/", AdminAccountDetailView.as_view()),
    path("api/v1/admin/activity/", AdminActivityView.as_view()),
    path("api/v1/audio/<int:pk>/stream/", AudioStream.as_view()),
    path("api/v1/audio/<int:pk>/playback/", AudioPlayback.as_view()),
    path("api/v1/progress/", ProgressView.as_view()),
    path("api/v1/responses/", ResponseView.as_view()),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
]
