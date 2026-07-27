from fastapi import APIRouter, HTTPException
from fastapi.params import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from models.orm import PostcodeSurveyor
from schemas.postcode import PostcodeSurveyorCreate, PostcodeSurveyorUpdate, PostcodeSurveyorOut

router = APIRouter(prefix="/postcode", tags=["postcode"])


@router.get("/", response_model=list[PostcodeSurveyorOut])
async def list_postcode_surveyors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PostcodeSurveyor).order_by(PostcodeSurveyor.postcode_area, PostcodeSurveyor.name)
    )
    return result.scalars().all()


@router.post("/", response_model=PostcodeSurveyorOut, status_code=201)
async def add_postcode_surveyor(
    payload: PostcodeSurveyorCreate,
    db: AsyncSession = Depends(get_db),
):
    entry = PostcodeSurveyor(**payload.model_dump(), is_custom=True)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/{id}", response_model=PostcodeSurveyorOut)
async def update_postcode_surveyor(
    id: int,
    payload: PostcodeSurveyorUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PostcodeSurveyor).where(PostcodeSurveyor.id == id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Surveyor not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{id}", status_code=204)
async def delete_postcode_surveyor(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PostcodeSurveyor).where(PostcodeSurveyor.id == id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Surveyor not found")
    await db.delete(entry)
    await db.commit()
