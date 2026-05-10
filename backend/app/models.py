from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), index=True)  # manager | courier


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)


class SlotTemplate(Base):
    __tablename__ = "slot_templates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    start_time: Mapped[str] = mapped_column(String(5))  # HH:MM
    end_time: Mapped[str] = mapped_column(String(5))  # HH:MM


class Slot(Base):
    __tablename__ = "slots"
    __table_args__ = (
        UniqueConstraint("store_id", "start_at", "end_at", name="uq_slots_store_time"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[int] = mapped_column(index=True)
    action: Mapped[str] = mapped_column(String(100))
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    payload: Mapped[str] = mapped_column(String(2000), default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
