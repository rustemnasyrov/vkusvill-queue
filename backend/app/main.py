import os
import socket
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.db import Base, engine, get_db
from app.models import User
from app.schemas import AuthTokens, LoginRequest, RefreshRequest, UserOut
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def _tcp_check(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _health_payload() -> Dict[str, Any]:
    pg_host = os.getenv("PGHOST", "localhost")
    pg_port = int(os.getenv("PGPORT", "5432"))
    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = int(os.getenv("REDIS_PORT", "6379"))

    db_ok = _tcp_check(pg_host, pg_port)
    redis_ok = _tcp_check(redis_host, redis_port)

    status = "ok" if db_ok and redis_ok else "degraded"
    return {
        "status": status,
        "checks": {
            "postgres": "up" if db_ok else "down",
            "redis": "up" if redis_ok else "down",
        },
    }


def _seed_users(db: Session) -> None:
    if db.query(User).count() > 0:
        return

    manager = User(
        email="manager@local.dev",
        full_name="Manager Dev",
        password_hash=hash_password("manager123"),
        role="manager",
    )
    courier = User(
        email="courier@local.dev",
        full_name="Courier Dev",
        password_hash=hash_password("courier123"),
        role="courier",
    )
    db.add_all([manager, courier])
    db.commit()


app = FastAPI(title="Vkusvill Slot Manager API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev only; tighten in later stages.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
with next(get_db()) as _db:
    _seed_users(_db)


@app.get("/")
def root() -> Dict[str, str]:
    return {"service": "vkusvill-slot-manager", "docs": "/docs", "health": "/health", "auth": "/auth/login"}


@app.get("/health")
def health() -> Dict[str, Any]:
    return _health_payload()


@app.post("/auth/login", response_model=AuthTokens)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthTokens:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(user.id, user.role, user.email)
    refresh_token = create_refresh_token(user.id, user.role, user.email)
    user_out = UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role)
    return AuthTokens(access_token=access_token, refresh_token=refresh_token, user=user_out)


@app.post("/auth/refresh", response_model=AuthTokens)
def refresh_tokens(payload: RefreshRequest, db: Session = Depends(get_db)) -> AuthTokens:
    try:
        token_payload = decode_token(payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if token_payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.get(User, int(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    access_token = create_access_token(user.id, user.role, user.email)
    refresh_token = create_refresh_token(user.id, user.role, user.email)
    user_out = UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role)
    return AuthTokens(access_token=access_token, refresh_token=refresh_token, user=user_out)


@app.get("/auth/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
    )


@app.get("/manager/ping")
def manager_ping(_: User = Depends(require_role("manager"))) -> Dict[str, str]:
    return {"status": "ok", "role": "manager"}


@app.get("/courier/ping")
def courier_ping(_: User = Depends(require_role("courier"))) -> Dict[str, str]:
    return {"status": "ok", "role": "courier"}
