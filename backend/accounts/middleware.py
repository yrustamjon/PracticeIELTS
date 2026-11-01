class AdminActivityMiddleware:
    """Record successful editor API changes without bodies, queries or credentials."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        user = getattr(request, "user", None)
        if (
            request.path.startswith("/api/v1/")
            and not request.path.startswith(("/api/v1/auth/", "/api/v1/admin/"))
            and request.method in ("POST", "PUT", "PATCH", "DELETE")
            and 200 <= response.status_code < 300
            and user is not None and user.is_authenticated and user.can_edit
        ):
            from learning.models import AuditLog
            AuditLog.objects.create(
                actor=user, action="api." + request.method.lower(),
                details={"path": request.path, "status": response.status_code},
            )
        return response
