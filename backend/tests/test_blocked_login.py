import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from accounts.models import User
from learning.models import AuditLog

pytestmark = pytest.mark.django_db
PASSWORD = 'Unique-study-739!'
MESSAGE = 'Your account has been blocked. Please contact the administrator.'


def test_blocked_login_explains_status_only_after_password_check():
    user = User.objects.create_user(username='blocked', password=PASSWORD, is_active=False)
    client = APIClient(enforce_csrf_checks=True)
    token = client.get('/api/v1/auth/csrf/').data['csrfToken']
    response = client.post('/api/v1/auth/login/', {'username': user.username, 'password': PASSWORD}, format='json', HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 403
    assert response.data == {'detail': MESSAGE}
    assert 'refresh' not in response.cookies
    assert not OutstandingToken.objects.filter(user=user).exists()
    assert not AuditLog.objects.filter(actor=user, action='auth.login').exists()
    for username, password in [(user.username, 'wrong'), ('missing-user', PASSWORD)]:
        response = client.post('/api/v1/auth/login/', {'username': username, 'password': password}, format='json', HTTP_X_CSRFTOKEN=token)
        assert response.status_code == 401
        assert response.data == {'detail': 'Incorrect username or password.'}
        assert 'refresh' not in response.cookies


def test_unblocked_account_can_sign_in_normally():
    user = User.objects.create_user(username='reenabled', password=PASSWORD, is_active=False)
    user.is_active = True
    user.save(update_fields=['is_active'])
    response = APIClient().post('/api/v1/auth/login/', {'username': user.username, 'password': PASSWORD}, format='json')
    assert response.status_code == 200
    assert response.data['access'] and response.data['user']['id'] == user.pk
    assert response.cookies['refresh']['httponly']


def test_blocked_login_still_requires_csrf():
    User.objects.create_user(username='csrf-blocked', password=PASSWORD, is_active=False)
    response = APIClient(enforce_csrf_checks=True).post('/api/v1/auth/login/', {'username': 'csrf-blocked', 'password': PASSWORD}, format='json')
    assert response.status_code == 403
    assert 'CSRF' in response.data['detail']
    assert response.data['detail'] != MESSAGE
