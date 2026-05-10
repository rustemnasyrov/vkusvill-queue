from datetime import datetime, timedelta, timezone
import os
from typing import Any, Dict

from jose import JWTError, jwt
from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-super-secret-key")
JWT_ALG = "HS256"
ACCESS_MINUTES = int(os.getenv("JWT_ACCESS_MINUTES", "30"))
REFRESH_MINUTES = int(os.getenv("JWT_REFRESH_MINUTES", "10080"))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def _create_token(payload: Dict[str, Any], expires_delta: timedelta) -> str:
    to_encode = payload.copy()
    now = datetime.now(tz=timezone.utc)
    to_encode.update({"iat": now, "exp": now + expires_delta})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


def create_access_token(user_id: int, role: str, email: str) -> str:
    return _create_token(
        {"sub": str(user_id), "role": role, "email": email, "type": "access"},
        timedelta(minutes=ACCESS_MINUTES),
    )


def create_refresh_token(user_id: int, role: str, email: str) -> str:
    return _create_token(
        {"sub": str(user_id), "role": role, "email": email, "type": "refresh"},
        timedelta(minutes=REFRESH_MINUTES),
    )


def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
