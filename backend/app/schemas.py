from datetime import datetime

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str


class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class StoreOut(BaseModel):
    id: int
    name: str


class SlotTemplateOut(BaseModel):
    id: int
    name: str
    start_time: str
    end_time: str


class SlotBatchCreateRequest(BaseModel):
    store_id: int
    template_id: int
    from_date: str  # YYYY-MM-DD
    to_date: str  # YYYY-MM-DD


class SlotCreateRequest(BaseModel):
    store_id: int
    start_at: datetime
    end_at: datetime
    status: str = "OPEN"


class SlotPatchRequest(BaseModel):
    status: str


class SlotMoveRequest(BaseModel):
    start_at: datetime
    end_at: datetime


class SlotOut(BaseModel):
    id: int
    store_id: int
    status: str
    start_at: datetime
    end_at: datetime


class SlotBatchCreateResponse(BaseModel):
    created: int
    skipped: int
