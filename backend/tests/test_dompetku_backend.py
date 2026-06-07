"""
Dompetku backend tests — JWT auth + AES-256-GCM encrypted per-user JSON storage.
Covers: register/login validation, /auth/me, /data GET/PUT roundtrip,
data isolation between users, and encryption-at-rest sanity check.
"""

import os
import uuid
import json
import base64
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://finance-vault-auth.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Unique suffix so reruns don't collide
SUFFIX = uuid.uuid4().hex[:8]
USER_A = {"username": f"test_a_{SUFFIX}", "password": "passA123", "email": f"a_{SUFFIX}@example.com"}
USER_B = {"username": f"test_b_{SUFFIX}", "password": "passB123", "email": f"b_{SUFFIX}@example.com"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def registered_users(session):
    tokens = {}
    for u in (USER_A, USER_B):
        r = session.post(f"{API}/auth/register", json=u, timeout=15)
        assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
        data = r.json()
        assert "access_token" in data and data["token_type"] == "bearer"
        assert data["user"]["username"] == u["username"]
        assert data["user"]["email"] == u["email"]
        assert isinstance(data["user"]["id"], str) and len(data["user"]["id"]) > 0
        tokens[u["username"]] = {"token": data["access_token"], "id": data["user"]["id"]}
    return tokens


# ---------- Health ----------
class TestHealth:
    def test_root_api(self, session):
        r = session.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- Register ----------
class TestRegister:
    def test_register_success(self, registered_users):
        # fixture already covers happy path with assertions
        assert USER_A["username"] in registered_users
        assert USER_B["username"] in registered_users

    def test_register_duplicate_username(self, session, registered_users):
        r = session.post(f"{API}/auth/register", json=USER_A, timeout=15)
        assert r.status_code == 400
        assert "Username" in r.json().get("detail", "")

    def test_register_duplicate_email(self, session, registered_users):
        body = {"username": f"otheruser_{SUFFIX}", "password": "pw12345", "email": USER_A["email"]}
        r = session.post(f"{API}/auth/register", json=body, timeout=15)
        assert r.status_code == 400
        assert "Email" in r.json().get("detail", "")

    def test_register_short_username(self, session):
        r = session.post(f"{API}/auth/register", json={"username": "ab", "password": "pw12345"}, timeout=15)
        assert r.status_code == 422

    def test_register_short_password(self, session):
        r = session.post(f"{API}/auth/register", json={"username": f"u_{SUFFIX}_x", "password": "123"}, timeout=15)
        assert r.status_code == 422


# ---------- Login ----------
class TestLogin:
    def test_login_with_username(self, session, registered_users):
        r = session.post(f"{API}/auth/login", json={"username": USER_A["username"], "password": USER_A["password"]}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["username"] == USER_A["username"]

    def test_login_with_email(self, session, registered_users):
        r = session.post(f"{API}/auth/login", json={"username": USER_A["email"], "password": USER_A["password"]}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["username"] == USER_A["username"]

    def test_login_wrong_password(self, session, registered_users):
        r = session.post(f"{API}/auth/login", json={"username": USER_A["username"], "password": "WRONG"}, timeout=15)
        assert r.status_code == 401
        assert r.json().get("detail") == "Username atau password salah"

    def test_login_unknown_user(self, session):
        r = session.post(f"{API}/auth/login", json={"username": f"ghost_{SUFFIX}", "password": "whatever"}, timeout=15)
        assert r.status_code == 401


# ---------- /auth/me ----------
class TestAuthMe:
    def test_me_valid(self, session, registered_users):
        token = registered_users[USER_A["username"]]["token"]
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["username"] == USER_A["username"]
        assert body["email"] == USER_A["email"]
        assert body["id"] == registered_users[USER_A["username"]]["id"]

    def test_me_no_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code in (401, 403)

    def test_me_invalid_token(self, session):
        r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.real.jwt"}, timeout=15)
        assert r.status_code == 401


# ---------- /data GET / PUT roundtrip + isolation ----------
class TestData:
    def test_get_initial_empty(self, session, registered_users):
        token = registered_users[USER_A["username"]]["token"]
        r = session.get(f"{API}/data", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("incomes", "expenses", "budgets", "targets"):
            assert d.get(k) == []

    def test_put_then_get_roundtrip(self, session, registered_users):
        token = registered_users[USER_A["username"]]["token"]
        payload = {
            "incomes": [{"id": "i1", "amount": 1000000, "category": "gaji"}],
            "expenses": [{"id": "e1", "amount": 50000, "category": "makanan"}],
            "budgets": [{"id": "b1", "category": "makanan", "limit": 500000}],
            "targets": [{"id": "t1", "name": "Liburan", "amount": 5000000}],
        }
        r = session.put(f"{API}/data", json=payload, headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        assert "saved_at" in body

        # GET back
        r2 = session.get(f"{API}/data", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r2.status_code == 200
        assert r2.json() == payload

    def test_data_isolation(self, session, registered_users):
        token_b = registered_users[USER_B["username"]]["token"]
        # User B should still have empty data, NOT see User A's payload
        r = session.get(f"{API}/data", headers={"Authorization": f"Bearer {token_b}"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("incomes", "expenses", "budgets", "targets"):
            assert d.get(k) == []

    def test_data_requires_auth(self, session):
        r = session.get(f"{API}/data", timeout=15)
        assert r.status_code in (401, 403)
        r2 = session.put(f"{API}/data", json={"incomes": [], "expenses": [], "budgets": [], "targets": []}, timeout=15)
        assert r2.status_code in (401, 403)


# ---------- Encryption at rest ----------
class TestEncryptionAtRest:
    """Verify files on disk are ciphertext, not plaintext JSON."""

    DATA_DIR = Path("/app/backend/data")

    def test_users_file_is_not_plaintext_json(self):
        f = self.DATA_DIR / "users.json.enc"
        assert f.exists(), "users.json.enc must exist"
        raw = f.read_bytes()
        # Should NOT be parseable as JSON
        with pytest.raises(Exception):
            json.loads(raw)
        # Should not leak sensitive field names in plaintext
        text = raw.decode("utf-8", errors="ignore")
        assert "password_hash" not in text
        assert "bcrypt" not in text
        # base64 decodes successfully
        decoded = base64.b64decode(raw)
        assert len(decoded) > 12  # at least nonce + something

    def test_user_data_file_is_not_plaintext(self, registered_users):
        uid = registered_users[USER_A["username"]]["id"]
        f = self.DATA_DIR / "users" / f"{uid}.json.enc"
        assert f.exists(), f"per-user encrypted file must exist: {f}"
        raw = f.read_bytes()
        with pytest.raises(Exception):
            json.loads(raw)
        text = raw.decode("utf-8", errors="ignore")
        for needle in ("incomes", "expenses", "budgets", "targets", "Liburan", "makanan"):
            assert needle not in text, f"plaintext leak: {needle!r} found in encrypted file"
