from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from pydantic import BaseModel

from core.auth import create_access_token, get_current_user, require_admin
from core.config import settings
from core.database import get_db
from models.orm import User, UserRole, DEVELOPER_EMAIL, DEFAULT_PERMISSIONS, ALL_PAGES

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GoogleTokenRequest(BaseModel):
    credential: str


class TokenResponse(BaseModel):
    access_token:     str
    email:            str
    role:             str
    page_permissions: str | None = None


class UserOut(BaseModel):
    id:               int
    email:            str
    role:             str
    is_active:        bool
    page_permissions: str | None = None
    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: str
    role:  str = "user"


class UserUpdate(BaseModel):
    role:             str | None = None
    is_active:        bool | None = None
    page_permissions: str | None = None


# ---------------------------------------------------------------------------
# Google login
# ---------------------------------------------------------------------------

@router.post("/google", response_model=TokenResponse)
async def google_login(payload: GoogleTokenRequest, db: AsyncSession = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google auth not configured")
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = idinfo.get("email", "").lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your account is not approved. Contact an administrator.",
        )

    # Developer always gets all pages regardless of what's stored
    if user.role == UserRole.developer:
        effective_permissions = ALL_PAGES
    else:
        effective_permissions = user.page_permissions or DEFAULT_PERMISSIONS.get(user.role.value, "")
    return TokenResponse(
        access_token=create_access_token(email=email, role=user.role.value),
        email=email,
        role=user.role.value,
        page_permissions=effective_permissions,
    )


# ---------------------------------------------------------------------------
# Current user
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# User management (admin only)
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserOut])
async def list_users(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.email))
    return result.scalars().all()


@router.post("/users", response_model=UserOut, status_code=201)
async def add_user(
    payload: UserCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.lower()
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="User already exists")
    try:
        role = UserRole(payload.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")
    user = User(email=email, role=role)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Developer accounts can never be modified by non-developers
    if user.email == DEVELOPER_EMAIL and current_user.role != UserRole.developer:
        raise HTTPException(status_code=403, detail="Cannot modify the developer account")

    # Only developer can set role to developer or change another admin's permissions
    if payload.role == "developer":
        raise HTTPException(status_code=403, detail="Cannot assign developer role")
    if payload.role is not None and user.role == UserRole.admin and current_user.role != UserRole.developer:
        raise HTTPException(status_code=403, detail="Only a developer can change an admin's role")

    if payload.role is not None:
        try:
            user.role = UserRole(payload.role)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role")
    if payload.is_active is not None:
        if user.id == current_user.id and not payload.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        user.is_active = payload.is_active
    if payload.page_permissions is not None:
        user.page_permissions = payload.page_permissions or None
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
async def remove_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove your own account")
    await db.delete(user)
    await db.commit()
