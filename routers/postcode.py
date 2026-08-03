from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.params import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Integer
from sqlalchemy import text

from core.database import get_db
from models.orm import PostcodeSurveyor, Surveyor
from schemas.postcode import (
    PostcodeSurveyorCreate, PostcodeSurveyorUpdate, PostcodeSurveyorOut, PostcodeSurveyorBulkCreate,
)

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
    entry = PostcodeSurveyor(**payload.model_dump(), is_custom=True, added_at=datetime.now(timezone.utc))
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.post("/bulk", response_model=list[PostcodeSurveyorOut], status_code=201)
async def add_postcode_surveyor_bulk(
    payload: PostcodeSurveyorBulkCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add one surveyor covering multiple postcode areas in one go — creates a
    separate row per area (each still edited/shown independently), sharing the
    surveyor's name/number/fee category/work types/base postcode."""
    shared = payload.model_dump(exclude={"areas"})
    now = datetime.now(timezone.utc)
    entries = [
        PostcodeSurveyor(**shared, postcode_area=area.postcode_area, coverage=area.coverage,
                          is_custom=True, added_at=now)
        for area in payload.areas
    ]
    db.add_all(entries)
    await db.commit()
    for entry in entries:
        await db.refresh(entry)
    return entries


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

    # Sync relevant fields to surveyors table if surveyor_number matches
    sync_fields = {k for k in ('base_postcode', 'work_types', 'fee_cat') if k in updates}
    if sync_fields and entry.surveyor_number:
        result = await db.execute(
            select(Surveyor).where(Surveyor.surveyor_number == entry.surveyor_number)
        )
        surveyor = result.scalar_one_or_none()
        if surveyor:
            for field in sync_fields:
                setattr(surveyor, field, getattr(entry, field))
            await db.commit()

    return entry


@router.delete("/by-number/{surveyor_number}", status_code=204)
async def delete_postcode_surveyor_by_number(surveyor_number: str, db: AsyncSession = Depends(get_db)):
    """Remove every postcode-area row for this surveyor number (not just one area)."""
    result = await db.execute(
        select(PostcodeSurveyor).where(PostcodeSurveyor.surveyor_number == surveyor_number)
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="Surveyor not found")
    for row in rows:
        await db.delete(row)
    await db.commit()


@router.delete("/{id}", status_code=204)
async def delete_postcode_surveyor(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PostcodeSurveyor).where(PostcodeSurveyor.id == id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Surveyor not found")
    await db.delete(entry)
    await db.commit()
