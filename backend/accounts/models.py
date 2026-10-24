from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        TEACHER = "teacher", "Teacher"
        ADMIN = "admin", "Administrator"

    role = models.CharField(max_length=12, choices=Role.choices, default=Role.STUDENT)

    @property
    def can_edit(self):
        return self.is_active and (
            self.is_staff or self.role in (self.Role.TEACHER, self.Role.ADMIN)
        )
