from fastapi import APIRouter, HTTPException
from fastapi.params import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Integer
from sqlalchemy import text

from core.database import get_db
from models.orm import PostcodeSurveyor, Surveyor
from schemas.postcode import PostcodeSurveyorCreate, PostcodeSurveyorUpdate, PostcodeSurveyorOut

router = APIRouter(prefix="/postcode", tags=["postcode"])


@router.get("/", response_model=list[PostcodeSurveyorOut])
async def list_postcode_surveyors(db: AsyncSession = Depends(get_db)):
    # Sort by area A-Z, then by first number in surveyor_number numerically, NULLs last
    result = await db.execute(
        select(PostcodeSurveyor).order_by(
            PostcodeSurveyor.postcode_area,
            text("(regexp_match(surveyor_number, '(\\d+)'))[1]::integer ASC NULLS LAST"),
        )
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
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)

    # If base_postcode changed and this entry has a surveyor_number, sync to surveyors table
    if 'base_postcode' in updates and entry.surveyor_number:
        result = await db.execute(
            select(Surveyor).where(Surveyor.surveyor_number == entry.surveyor_number)
        )
        surveyor = result.scalar_one_or_none()
        if surveyor:
            surveyor.base_postcode = entry.base_postcode
            await db.commit()

    return entry


@router.delete("/{id}", status_code=204)
async def delete_postcode_surveyor(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PostcodeSurveyor).where(PostcodeSurveyor.id == id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Surveyor not found")
    await db.delete(entry)
    await db.commit()
