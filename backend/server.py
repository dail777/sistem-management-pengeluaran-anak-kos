"""
Dompetku Backend — JWT auth + AES-256-GCM encrypted per-user JSON storage.
"""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import json
import uuid
import base64
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Any, Dict

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# ============ CONFIG ============
DATA_DIR = Path(os.environ["DATA_DIR"])
USERS_FILE = DATA_DIR / "users.json.enc"
USER_DATA_DIR = DATA_DIR / "users"
DATA_DIR.mkdir(parents=True, exist_ok=True)
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
JWT_EXPIRY_DAYS = 7

AES_KEY = base64.b64decode(os.environ["AES_KEY"])
assert len(AES_KEY) == 32, "AES_KEY must decode to 32 bytes (AES-256)"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("dompetku")


# ============ ENCRYPTION (AES-256-GCM) ============
def encrypt_bytes(plaintext: bytes) -> bytes:
    aesgcm = AESGCM(AES_KEY)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext, None)
    return base64.b64encode(nonce + ct)


def decrypt_bytes(token: bytes) -> bytes:
    raw = base64.b64decode(token)
    nonce, ct = raw[:12], raw[12:]
    aesgcm = AESGCM(AES_KEY)
    return aesgcm.decrypt(nonce, ct, None)


def write_encrypted_json(path: Path, data: Any) -> None:
    plaintext = json.dumps(data, ensure_ascii=False).encode("utf-8")
    enc = encrypt_bytes(plaintext)
    path.write_bytes(enc)


def read_encrypted_json(path: Path, default: Any) -> Any:
    if not path.exists() or path.stat().st_size == 0:
        return default
    try:
        token = path.read_bytes()
        pt = decrypt_bytes(token)
        return json.loads(pt.decode("utf-8"))
    except Exception as e:
        logger.error("Failed to decrypt %s: %s", path, e)
        raise HTTPException(status_code=500, detail="Data file corrupted or key invalid")


# ============ USER STORE ============
def load_users() -> Dict[str, dict]:
    return read_encrypted_json(USERS_FILE, default={})


def save_users(users: Dict[str, dict]) -> None:
    write_encrypted_json(USERS_FILE, users)


def get_user_data_path(user_id: str) -> Path:
    return USER_DATA_DIR / f"{user_id}.json.enc"


def empty_user_data() -> dict:
    return {"incomes": [], "expenses": [], "budgets": [], "targets": []}


def load_user_data(user_id: str) -> dict:
    return read_encrypted_json(get_user_data_path(user_id), default=empty_user_data())


def save_user_data(user_id: str, data: dict) -> None:
    write_encrypted_json(get_user_data_path(user_id), data)


# ============ PASSWORD ============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ============ JWT ============
def create_access_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token = None
    if creds and creds.scheme.lower() == "bearer":
        token = creds.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    users = load_users()
    user = users.get(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"id": user_id, "username": user["username"], "email": user.get("email")}


# ============ PYDANTIC MODELS ============
class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)
    email: Optional[EmailStr] = None


class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str] = None


class AuthOut(BaseModel):
    user: UserOut
    access_token: str
    token_type: str = "bearer"


class UserDataIn(BaseModel):
    incomes: list = []
    expenses: list = []
    budgets: list = []
    targets: list = []


# ============ APP ============
app = FastAPI(title="Dompetku Backend")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"message": "Dompetku API", "status": "ok"}


@api.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn):
    username = body.username.strip().lower()
    if not all(ch.isalnum() or ch == "_" for ch in username):
        raise HTTPException(status_code=400, detail="Username hanya boleh huruf, angka, atau underscore")

    users = load_users()
    # check username unique
    for uid, u in users.items():
        if u["username"] == username:
            raise HTTPException(status_code=400, detail="Username sudah digunakan")
        if body.email and u.get("email") and u["email"].lower() == body.email.lower():
            raise HTTPException(status_code=400, detail="Email sudah digunakan")

    user_id = str(uuid.uuid4())
    users[user_id] = {
        "username": username,
        "email": body.email.lower() if body.email else None,
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    save_users(users)
    # initialize empty encrypted data file
    save_user_data(user_id, empty_user_data())

    token = create_access_token(user_id, username)
    return AuthOut(
        user=UserOut(id=user_id, username=username, email=users[user_id]["email"]),
        access_token=token,
    )


@api.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    username = body.username.strip().lower()
    users = load_users()
    found_uid = None
    found_user = None
    for uid, u in users.items():
        if u["username"] == username or (u.get("email") and u["email"].lower() == username):
            found_uid = uid
            found_user = u
            break
    if not found_user:
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if not verify_password(body.password, found_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")

    token = create_access_token(found_uid, found_user["username"])
    return AuthOut(
        user=UserOut(id=found_uid, username=found_user["username"], email=found_user.get("email")),
        access_token=token,
    )


@api.get("/auth/me", response_model=UserOut)
async def me(current=Depends(get_current_user)):
    return UserOut(**current)


@api.get("/data")
async def get_data(current=Depends(get_current_user)):
    """Return the decrypted user data."""
    data = load_user_data(current["id"])
    return data


@api.put("/data")
async def put_data(body: UserDataIn, current=Depends(get_current_user)):
    """Encrypt and persist the user's full data set."""
    data = body.model_dump()
    save_user_data(current["id"], data)
    return {"ok": True, "saved_at": datetime.now(timezone.utc).isoformat()}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
