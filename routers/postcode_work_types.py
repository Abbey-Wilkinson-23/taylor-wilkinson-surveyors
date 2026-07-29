from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from core.database import get_db
from models.orm import PostcodeWorkType

router = APIRouter(prefix="/postcode-work-types", tags=["postcode-work-types"])


class WorkTypeOut(BaseModel):
    id:   int
    name: str
    model_config = {"from_attributes": True}


class WorkTypeIn(BaseModel):
    name: str


@router.get("/", response_model=list[WorkTypeOut])
async def list_work_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PostcodeWorkType).order_by(PostcodeWorkType.name))
    return result.scalars().all()


@router.post("/", response_model=WorkTypeOut, status_code=201)
async def create_work_type(payload: WorkTypeIn, db: AsyncSession = Depends(get_db)):
    wt = PostcodeWorkType(name=payload.name.strip())
    db.add(wt)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Work type already exists")
    await db.refresh(wt)
    return wt


@router.patch("/{id}", response_model=WorkTypeOut)
async def update_work_type(id: int, payload: WorkTypeIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PostcodeWorkType).where(PostcodeWorkType.id == id))
    wt = result.scalar_one_or_none()
    if not wt:
        raise HTTPException(status_code=404, detail="Not found")
    wt.name = payload.name.strip()
    await db.commit()
    await db.refresh(wt)
    return wt


@router.delete("/{id}", status_code=204)
async def delete_work_type(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PostcodeWorkType).where(PostcodeWorkType.id == id))
    wt = result.scalar_one_or_none()
    if not wt:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(wt)
    await db.commit()
