"""
Iteration 3 backend tests:
- DELETE /api/admin/users/{uid}: admin can delete user; deletes encrypted data file;
  cannot delete admin own account; non-admin → 403; unknown id → 404;
  deleted user can no longer log in and their old token returns 401 on /auth/me.
- POST /api/admin/me/password: admin changes own password; non-admin → 403;
  validation min 6 chars; RESTORES password back to admin123 at the end.
"""

import os
import uuid
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://finance-vault-auth.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PW = "admin123"
ADMIN = {"username": "admin", "password": ADMIN_PW}

USER_DATA_DIR = Path("/app/backend/data/users")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, username, password):
    r = session.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=15)
    return r


def _admin_token(session, password=ADMIN_PW):
    r = _login(session, "admin", password)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _register(session, suffix):
    payload = {"username": f"it3_{suffix}", "password": "userpass1", "email": f"it3_{suffix}@example.com"}
    r = session.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    return {
        "id": body["user"]["id"],
        "username": body["user"]["username"],
        "token": body["access_token"],
        "password": payload["password"],
    }


# ============ DELETE USER ============
class TestAdminDeleteUser:
    def test_delete_user_removes_user_and_data_file(self, session):
        token = _admin_token(session)
        u = _register(session, uuid.uuid4().hex[:8])

        # Confirm data file exists
        data_file = USER_DATA_DIR / f"{u['id']}.json.enc"
        assert data_file.exists(), f"data file missing pre-delete: {data_file}"

        # DELETE
        r = session.delete(
            f"{API}/admin/users/{u['id']}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("deleted") == u["username"]

        # Data file removed
        assert not data_file.exists(), f"data file still exists after delete: {data_file}"

        # User can no longer log in
        r_login = _login(session, u["username"], u["password"])
        assert r_login.status_code == 401

        # Old token now returns 401 on /auth/me with 'User not found' detail
        r_me = session.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {u['token']}"},
            timeout=15,
        )
        assert r_me.status_code == 401
        assert "user not found" in r_me.json().get("detail", "").lower()

    def test_delete_admin_self_forbidden_400(self, session):
        token = _admin_token(session)
        r_me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r_me.status_code == 200
        admin_uid = r_me.json()["id"]
        r = session.delete(
            f"{API}/admin/users/{admin_uid}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "admin" in r.json().get("detail", "").lower()
        # admin can still log in
        assert _login(session, "admin", ADMIN_PW).status_code == 200

    def test_delete_user_non_admin_forbidden(self, session):
        u = _register(session, uuid.uuid4().hex[:8])
        other = _register(session, uuid.uuid4().hex[:8])
        r = session.delete(
            f"{API}/admin/users/{other['id']}",
            headers={"Authorization": f"Bearer {u['token']}"},
            timeout=15,
        )
        assert r.status_code == 403

    def test_delete_user_unknown_id_404(self, session):
        token = _admin_token(session)
        r = session.delete(
            f"{API}/admin/users/does-not-exist-{uuid.uuid4().hex}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 404

    def test_delete_user_unauthenticated(self, session):
        r = session.delete(f"{API}/admin/users/anything", timeout=15)
        assert r.status_code in (401, 403)


# ============ ADMIN SELF PASSWORD CHANGE ============
class TestAdminSelfPassword:
    def test_non_admin_cannot_change_admin_self_pw(self, session):
        u = _register(session, uuid.uuid4().hex[:8])
        r = session.post(
            f"{API}/admin/me/password",
            json={"new_password": "whatever1"},
            headers={"Authorization": f"Bearer {u['token']}"},
            timeout=15,
        )
        assert r.status_code == 403

    def test_unauthenticated_cannot_change_admin_self_pw(self, session):
        r = session.post(f"{API}/admin/me/password", json={"new_password": "whatever1"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_new_password_too_short_returns_422(self, session):
        token = _admin_token(session)
        r = session.post(
            f"{API}/admin/me/password",
            json={"new_password": "x"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 422

    def test_admin_self_password_change_and_restore(self, session):
        token = _admin_token(session)
        new_pw = "AdminNew_" + uuid.uuid4().hex[:6]
        try:
            # Change
            r = session.post(
                f"{API}/admin/me/password",
                json={"new_password": new_pw},
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("ok") is True
            assert body.get("username") == "admin"

            # Old password no longer works
            r_old = _login(session, "admin", ADMIN_PW)
            assert r_old.status_code == 401, f"old pw should fail but got {r_old.status_code}"

            # New password works and re-login returns is_admin=True
            r_new = _login(session, "admin", new_pw)
            assert r_new.status_code == 200, r_new.text
            assert r_new.json()["user"]["is_admin"] is True
            new_token = r_new.json()["access_token"]

            # Existing /auth/me with new token works
            r_me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_token}"}, timeout=15)
            assert r_me.status_code == 200
            assert r_me.json()["is_admin"] is True
        finally:
            # ALWAYS restore admin password back to admin123
            # Use whichever token is currently valid
            restore_token = None
            r_try = _login(session, "admin", new_pw)
            if r_try.status_code == 200:
                restore_token = r_try.json()["access_token"]
            else:
                # already at admin123 somehow
                r_try2 = _login(session, "admin", ADMIN_PW)
                if r_try2.status_code == 200:
                    restore_token = r_try2.json()["access_token"]
            assert restore_token, "Could not obtain admin token to restore password!"
            r_restore = session.post(
                f"{API}/admin/me/password",
                json={"new_password": ADMIN_PW},
                headers={"Authorization": f"Bearer {restore_token}"},
                timeout=15,
            )
            assert r_restore.status_code == 200, f"FAILED TO RESTORE ADMIN PW: {r_restore.text}"
            # Final sanity: admin123 works again
            assert _login(session, "admin", ADMIN_PW).status_code == 200, "admin123 restore verify FAILED"
