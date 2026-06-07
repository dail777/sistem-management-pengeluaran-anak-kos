"""
Iteration 2 backend tests:
- Admin auto-seeded (admin/admin123), is_admin=True on login.
- /api/admin/users GET (requires admin, supports ?q= filter).
- /api/admin/users/{uid}/password POST (admin can change other users' passwords; not own).
- /api/auth/refresh issues a new access_token, requires auth.
- Admin cannot PUT /api/data.
"""

import os
import uuid
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://finance-vault-auth.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUFFIX = uuid.uuid4().hex[:8]
USER_X = {"username": f"it2_x_{SUFFIX}", "password": "userpass1", "email": f"it2x_{SUFFIX}@example.com"}
USER_Y = {"username": f"it2_y_{SUFFIX}", "password": "userpass2", "email": f"it2y_{SUFFIX}@example.com"}

ADMIN = {"username": "admin", "password": "admin123"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["username"] == "admin"
    assert data["user"]["is_admin"] is True, "admin user must have is_admin=True"
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="module")
def reg_users(session):
    out = {}
    for u in (USER_X, USER_Y):
        r = session.post(f"{API}/auth/register", json=u, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        out[u["username"]] = {
            "id": body["user"]["id"],
            "token": body["access_token"],
            "password": u["password"],
            "email": u["email"],
        }
        # Regular users must NOT be flagged as admin
        assert body["user"].get("is_admin") is False
    return out


# ---------- Admin auth/login ----------
class TestAdminLogin:
    def test_admin_login_is_admin_flag(self, admin_token):
        # admin_token fixture already asserts is_admin=True
        assert isinstance(admin_token, str) and len(admin_token) > 0

    def test_regular_user_is_not_admin(self, reg_users):
        for username, info in reg_users.items():
            # confirmed via fixture; sanity
            assert info["token"]


# ---------- /api/admin/users (list + search) ----------
class TestAdminUsersList:
    def test_requires_auth(self, session):
        r = session.get(f"{API}/admin/users", timeout=15)
        assert r.status_code in (401, 403)

    def test_forbidden_for_regular_user(self, session, reg_users):
        token = reg_users[USER_X["username"]]["token"]
        r = session.get(f"{API}/admin/users", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 403
        assert "admin" in r.json().get("detail", "").lower()

    def test_admin_list_users(self, session, admin_token, reg_users):
        r = session.get(f"{API}/admin/users", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "total" in body and "users" in body
        assert isinstance(body["users"], list)
        assert body["total"] == len(body["users"])
        # Both reg users present
        usernames = [u["username"] for u in body["users"]]
        assert USER_X["username"] in usernames
        assert USER_Y["username"] in usernames
        # Admin must NOT be in the list (hidden)
        assert "admin" not in usernames
        # Each entry has required fields
        sample = next(u for u in body["users"] if u["username"] == USER_X["username"])
        for k in ("id", "username", "email", "created_at"):
            assert k in sample
        assert sample["email"] == USER_X["email"]

    def test_admin_search_filter_username(self, session, admin_token):
        # Search with unique substring from USER_X username
        needle = USER_X["username"][:10]  # e.g. it2_x_xxxx
        r = session.get(
            f"{API}/admin/users",
            params={"q": needle},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        usernames = [u["username"] for u in body["users"]]
        assert USER_X["username"] in usernames
        # USER_Y has different prefix
        for u in usernames:
            assert needle.lower() in u.lower() or needle.lower() in (
                next(x for x in body["users"] if x["username"] == u).get("email") or ""
            ).lower()

    def test_admin_search_filter_email(self, session, admin_token):
        needle = USER_Y["email"].split("@")[0]
        r = session.get(
            f"{API}/admin/users",
            params={"q": needle},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        usernames = [u["username"] for u in r.json()["users"]]
        assert USER_Y["username"] in usernames

    def test_admin_search_no_match(self, session, admin_token):
        r = session.get(
            f"{API}/admin/users",
            params={"q": "zzz_no_such_user_zzz"},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["total"] == 0
        assert r.json()["users"] == []


# ---------- Admin change-password ----------
class TestAdminChangePassword:
    def test_admin_changes_user_password_and_user_can_login(self, session, admin_token, reg_users):
        uid = reg_users[USER_X["username"]]["id"]
        new_pw = "NewPass_" + uuid.uuid4().hex[:6]
        r = session.post(
            f"{API}/admin/users/{uid}/password",
            json={"new_password": new_pw},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        assert r.json().get("username") == USER_X["username"]

        # Old password no longer works
        r_old = session.post(
            f"{API}/auth/login",
            json={"username": USER_X["username"], "password": USER_X["password"]},
            timeout=15,
        )
        assert r_old.status_code == 401

        # New password works
        r_new = session.post(
            f"{API}/auth/login",
            json={"username": USER_X["username"], "password": new_pw},
            timeout=15,
        )
        assert r_new.status_code == 200
        # update stored token for downstream tests
        reg_users[USER_X["username"]]["token"] = r_new.json()["access_token"]
        reg_users[USER_X["username"]]["password"] = new_pw

    def test_regular_user_cannot_change_password(self, session, reg_users):
        uid_y = reg_users[USER_Y["username"]]["id"]
        token_x = reg_users[USER_X["username"]]["token"]
        r = session.post(
            f"{API}/admin/users/{uid_y}/password",
            json={"new_password": "whatever123"},
            headers={"Authorization": f"Bearer {token_x}"},
            timeout=15,
        )
        assert r.status_code == 403

    def test_admin_cannot_change_own_password(self, session, admin_token):
        # find admin's uid via /auth/me
        r_me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r_me.status_code == 200
        admin_uid = r_me.json()["id"]
        r = session.post(
            f"{API}/admin/users/{admin_uid}/password",
            json={"new_password": "shouldnotwork123"},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 400
        # admin can still log in with original password
        r_check = session.post(f"{API}/auth/login", json=ADMIN, timeout=15)
        assert r_check.status_code == 200

    def test_change_password_unknown_user(self, session, admin_token):
        r = session.post(
            f"{API}/admin/users/nonexistent-uid/password",
            json={"new_password": "abcdef1"},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 404

    def test_change_password_too_short_returns_422(self, session, admin_token, reg_users):
        uid = reg_users[USER_Y["username"]]["id"]
        r = session.post(
            f"{API}/admin/users/{uid}/password",
            json={"new_password": "x"},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 422


# ---------- /api/auth/refresh ----------
class TestRefreshToken:
    def test_refresh_no_token(self, session):
        r = session.post(f"{API}/auth/refresh", timeout=15)
        assert r.status_code in (401, 403)

    def test_refresh_invalid_token(self, session):
        r = session.post(
            f"{API}/auth/refresh",
            headers={"Authorization": "Bearer not.a.jwt"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_refresh_returns_new_token_and_works(self, session, reg_users):
        old = reg_users[USER_Y["username"]]["token"]
        # Sleep 1.1s so iat differs → token string differs
        time.sleep(1.1)
        r = session.post(
            f"{API}/auth/refresh",
            headers={"Authorization": f"Bearer {old}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body
        new_token = body["access_token"]
        assert new_token != old, "refresh must issue a new (different) token"
        assert body["user"]["username"] == USER_Y["username"]

        # New token works for /auth/me
        r_me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_token}"}, timeout=15)
        assert r_me.status_code == 200
        assert r_me.json()["username"] == USER_Y["username"]

        # Old token should ALSO still work (no revocation; sliding session)
        r_old = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {old}"}, timeout=15)
        assert r_old.status_code == 200

    def test_admin_can_refresh(self, session, admin_token):
        time.sleep(1.1)
        r = session.post(f"{API}/auth/refresh", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["is_admin"] is True
        assert r.json()["access_token"] != admin_token


# ---------- Admin cannot PUT /api/data ----------
class TestAdminCannotPutData:
    def test_admin_put_data_forbidden(self, session, admin_token):
        payload = {"incomes": [], "expenses": [], "budgets": [], "targets": []}
        r = session.put(
            f"{API}/data",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 403
        assert "Admin" in r.json().get("detail", "")

    def test_admin_can_get_data(self, session, admin_token):
        # GET /data is not blocked for admin (only PUT is). Returns empty defaults.
        r = session.get(f"{API}/data", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
