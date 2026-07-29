from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from core.database import get_db
from models.orm import PostcodeFeeType

router = APIRouter(prefix="/postcode-fee-types", tags=["postcode-fee-types"])


class FeeTypeOut(BaseModel):
    id:     int
    name:   str
    colour: str | None = None
    model_config = {"from_attributes": True}


class FeeTypeIn(BaseModel):
    name:   str
    colour: str | None = None


@router.get("/", response_model=list[FeeTypeOut])
async def list_fee_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PostcodeFeeType).order_by(PostcodeFeeType.name))
    return result.scalars().all()


@router.post("/", response_model=FeeTypeOut, status_code=201)
async def create_fee_type(payload: FeeTypeIn, db: AsyncSession = Depends(get_db)):
    ft = PostcodeFeeType(name=payload.name.strip(), colour=payload.colour or None)
    db.add(ft)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Fee type already exists")
    await db.refresh(ft)
    return ft


@router.patch("/{id}", response_model=FeeTypeOut)
async def update_fee_type(id: int, payload: FeeTypeIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PostcodeFeeType).where(PostcodeFeeType.id == id))
    ft = result.scalar_one_or_none()
    if not ft:
        raise HTTPException(status_code=404, detail="Not found")
    ft.name = payload.name.strip()
    if payload.colour is not None:
        ft.colour = payload.colour or None
    await db.commit()
    await db.refresh(ft)
    return ft


@router.delete("/{id}", status_code=204)
async def delete_fee_type(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PostcodeFeeType).where(PostcodeFeeType.id == id))
    ft = result.scalar_one_or_none()
    if not ft:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(ft)
    await db.commit()
