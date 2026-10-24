from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class PracticeUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("PracticeIELTS", {"fields": ("role",)}),)
