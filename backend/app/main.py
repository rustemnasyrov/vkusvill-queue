import os
import socket
from datetime import date, datetime, time, timedelta
import json
from typing import Any, Dict, List

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.db import Base, SessionLocal, engine, get_db
from app.models import AuditEvent, Slot, SlotTemplate, Store, User
from app.schemas import (
    AuthTokens,
    LoginRequest,
    RefreshRequest,
    SlotBatchCreateRequest,
    SlotBatchCreateResponse,
    SlotCreateRequest,
    SlotMoveRequest,
    SlotOut,
    SlotPatchRequest,
    SlotTemplateOut,
    StoreOut,
    UserOut,
)
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


def _seed_reference_data(db: Session) -> None:
    if db.query(Store).count() == 0:
        db.add_all([Store(name="Store #1"), Store(name="Store #2")])
        db.commit()

    if db.query(SlotTemplate).count() == 0:
        db.add_all(
            [
                SlotTemplate(name="Morning 10-12", start_time="10:00", end_time="12:00"),
                SlotTemplate(name="Afternoon 12-14", start_time="12:00", end_time="14:00"),
                SlotTemplate(name="Evening 18-20", start_time="18:00", end_time="20:00"),
            ]
        )
        db.commit()


def _parse_hhmm(value: str) -> time:
    try:
        hours, minutes = value.split(":")
        return time(hour=int(hours), minute=int(minutes))
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid time format: {value}") from exc


def _slot_to_out(slot: Slot) -> SlotOut:
    return SlotOut(
        id=slot.id,
        store_id=slot.store_id,
        status=slot.status,
        start_at=slot.start_at,
        end_at=slot.end_at,
    )


app = FastAPI(title="Vkusvill Slot Manager API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev only; tighten in later stages.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
with SessionLocal() as _db:
    _seed_users(_db)
    _seed_reference_data(_db)


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


@app.get("/manager/stores", response_model=List[StoreOut])
def list_stores(_: User = Depends(require_role("manager")), db: Session = Depends(get_db)) -> List[StoreOut]:
    stores = db.query(Store).order_by(Store.id.asc()).all()
    return [StoreOut(id=store.id, name=store.name) for store in stores]


@app.get("/manager/slot-templates", response_model=List[SlotTemplateOut])
def list_slot_templates(
    _: User = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> List[SlotTemplateOut]:
    templates = db.query(SlotTemplate).order_by(SlotTemplate.id.asc()).all()
    return [
        SlotTemplateOut(
            id=slot_template.id,
            name=slot_template.name,
            start_time=slot_template.start_time,
            end_time=slot_template.end_time,
        )
        for slot_template in templates
    ]


@app.post("/manager/slots/batch-create", response_model=SlotBatchCreateResponse)
def batch_create_slots(
    payload: SlotBatchCreateRequest,
    manager: User = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> SlotBatchCreateResponse:
    store = db.get(Store, payload.store_id)
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")

    template = db.get(SlotTemplate, payload.template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Slot template not found")

    try:
        from_day = date.fromisoformat(payload.from_date)
        to_day = date.fromisoformat(payload.to_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="from_date/to_date must be YYYY-MM-DD") from exc

    if to_day < from_day:
        raise HTTPException(status_code=400, detail="to_date must be greater or equal to from_date")

    start_time = _parse_hhmm(template.start_time)
    end_time = _parse_hhmm(template.end_time)
    if datetime.combine(from_day, end_time) <= datetime.combine(from_day, start_time):
        raise HTTPException(status_code=400, detail="Slot template end_time must be greater than start_time")

    created = 0
    skipped = 0
    current = from_day
    while current <= to_day:
        slot_start = datetime.combine(current, start_time)
        slot_end = datetime.combine(current, end_time)
        exists = (
            db.query(Slot)
            .filter(
                Slot.store_id == store.id,
                Slot.start_at == slot_start,
                Slot.end_at == slot_end,
            )
            .first()
        )
        if exists is not None:
            skipped += 1
            current = current + timedelta(days=1)
            continue

        slot = Slot(store_id=store.id, status="OPEN", start_at=slot_start, end_at=slot_end)
        db.add(slot)
        db.flush()
        created += 1
        db.add(
            AuditEvent(
                entity_type="slot",
                entity_id=slot.id,
                action="manager.batch_create",
                actor_user_id=manager.id,
                payload=json.dumps({"store_id": store.id, "date": current.isoformat()}),
            )
        )
        current = current + timedelta(days=1)

    db.commit()
    return SlotBatchCreateResponse(created=created, skipped=skipped)


@app.post("/manager/slots", response_model=SlotOut)
def create_slot(
    payload: SlotCreateRequest,
    manager: User = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> SlotOut:
    if payload.end_at <= payload.start_at:
        raise HTTPException(status_code=400, detail="end_at must be greater than start_at")
    if payload.status not in {"OPEN", "BOOKED", "CLOSED", "CANCELLED"}:
        raise HTTPException(status_code=400, detail=f"Unsupported status: {payload.status}")

    store = db.get(Store, payload.store_id)
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")

    exists = (
        db.query(Slot)
        .filter(
            Slot.store_id == payload.store_id,
            Slot.start_at == payload.start_at,
            Slot.end_at == payload.end_at,
        )
        .first()
    )
    if exists is not None:
        raise HTTPException(status_code=409, detail="Slot already exists for same time")

    slot = Slot(
        store_id=payload.store_id,
        status=payload.status,
        start_at=payload.start_at,
        end_at=payload.end_at,
    )
    db.add(slot)
    db.flush()
    db.add(
        AuditEvent(
            entity_type="slot",
            entity_id=slot.id,
            action="manager.create_slot",
            actor_user_id=manager.id,
            payload=json.dumps(
                {
                    "store_id": payload.store_id,
                    "start_at": payload.start_at.isoformat(),
                    "end_at": payload.end_at.isoformat(),
                    "status": payload.status,
                }
            ),
        )
    )
    db.commit()
    db.refresh(slot)
    return _slot_to_out(slot)


@app.get("/manager/slots", response_model=List[SlotOut])
def list_manager_slots(
    storeId: int,
    from_: str = Query(alias="from"),
    to: str = Query(),
    _: User = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> List[SlotOut]:
    try:
        from_dt = datetime.fromisoformat(f"{from_}T00:00:00")
        to_dt = datetime.fromisoformat(f"{to}T23:59:59")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="from/to must be YYYY-MM-DD") from exc

    slots = (
        db.query(Slot)
        .filter(
            Slot.store_id == storeId,
            Slot.start_at >= from_dt,
            Slot.start_at <= to_dt,
        )
        .order_by(Slot.start_at.asc())
        .all()
    )
    return [_slot_to_out(slot) for slot in slots]


@app.patch("/manager/slots/{slot_id}", response_model=SlotOut)
def patch_slot_status(
    slot_id: int,
    payload: SlotPatchRequest,
    manager: User = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> SlotOut:
    allowed_statuses = {"OPEN", "BOOKED", "CLOSED", "CANCELLED"}
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Unsupported status: {payload.status}")

    slot = db.get(Slot, slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="Slot not found")

    slot.status = payload.status
    db.add(
        AuditEvent(
            entity_type="slot",
            entity_id=slot.id,
            action="manager.patch_status",
            actor_user_id=manager.id,
            payload=json.dumps({"status": payload.status}),
        )
    )
    db.commit()
    db.refresh(slot)
    return _slot_to_out(slot)


@app.patch("/manager/slots/{slot_id}/move", response_model=SlotOut)
def move_slot(
    slot_id: int,
    payload: SlotMoveRequest,
    manager: User = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> SlotOut:
    slot = db.get(Slot, slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="Slot not found")
    if payload.end_at <= payload.start_at:
        raise HTTPException(status_code=400, detail="end_at must be greater than start_at")

    slot.start_at = payload.start_at
    slot.end_at = payload.end_at
    db.add(
        AuditEvent(
            entity_type="slot",
            entity_id=slot.id,
            action="manager.move_slot",
            actor_user_id=manager.id,
            payload=json.dumps(
                {
                    "start_at": payload.start_at.isoformat(),
                    "end_at": payload.end_at.isoformat(),
                }
            ),
        )
    )
    db.commit()
    db.refresh(slot)
    return _slot_to_out(slot)
