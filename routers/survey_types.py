from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from models.orm import SurveyType
from schemas.surveyor import SurveyTypeCreate, SurveyTypeUpdate, SurveyTypeOut

router = APIRouter(prefix="/survey-types", tags=["survey types"])


@router.post("/", response_model=SurveyTypeOut, status_code=201)
async def create_survey_type(payload: SurveyTypeCreate, db: AsyncSession = Depends(get_db)):
    survey_type = SurveyType(**payload.model_dump())
    db.add(survey_type)
    await db.commit()
    await db.refresh(survey_type)
    return survey_type


@router.get("/", response_model=list[SurveyTypeOut])
async def list_survey_types(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    query = select(SurveyType)
    if active_only:
        query = query.where(SurveyType.is_active == True)
    result = await db.execute(query.order_by(SurveyType.name))
    return result.scalars().all()


@router.patch("/{id}", response_model=SurveyTypeOut)
async def update_survey_type(
    id: int,
    payload: SurveyTypeUpdate,
    db: AsyncSession = Depends(get_db),
):
    survey_type = await db.get(SurveyType, id)
    if not survey_type:
        raise HTTPException(status_code=404, detail="Survey type not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(survey_type, field, value)
    await db.commit()
    await db.refresh(survey_type)
    return survey_type


@router.delete("/{id}", status_code=204)
async def delete_survey_type(id: int, db: AsyncSession = Depends(get_db)):
    survey_type = await db.get(SurveyType, id)
    if not survey_type:
        raise HTTPException(status_code=404, detail="Survey type not found")
    survey_type.is_active = False
    await db.commit()


@router.post("/{id}/restore", response_model=SurveyTypeOut)
async def restore_survey_type(id: int, db: AsyncSession = Depends(get_db)):
    survey_type = await db.get(SurveyType, id)
    if not survey_type:
        raise HTTPException(status_code=404, detail="Survey type not found")
    survey_type.is_active = True
    await db.commit()
    await db.refresh(survey_type)
    return survey_type
