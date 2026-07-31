from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Integer, select
from sqlalchemy.orm import selectinload

from core.database import get_db
from models.orm import Client, PostcodeSurveyor, Surveyor, SurveyorClientExclusion, SurveyorCoverage, SurveyorQualification, SurveyType
from schemas.surveyor import SurveyorCreate, SurveyorDetail, SurveyorOut, SurveyorUpdate

router = APIRouter(prefix="/surveyors", tags=["surveyors"])

DETAIL_OPTS = [
    selectinload(Surveyor.coverage),
    selectinload(Surveyor.qualifications).selectinload(SurveyorQualification.survey_type),
    selectinload(Surveyor.client_exclusions).selectinload(SurveyorClientExclusion.client),
]


async def get_surveyor_or_404(id: int, db: AsyncSession) -> Surveyor:
    result = await db.execute(
        select(Surveyor).where(Surveyor.id == id).options(*DETAIL_OPTS)
    )
    surveyor = result.scalar_one_or_none()
    if not surveyor:
        raise HTTPException(status_code=404, detail="Surveyor not found")
    return surveyor


def _to_orm_fields(data: dict) -> dict:
    """Map API field names to ORM column names."""
    if 'qualification' in data:
        data['rics_number'] = data.pop('qualification')
    return data


@router.post("/", response_model=SurveyorDetail, status_code=201)
async def create_surveyor(payload: SurveyorCreate, db: AsyncSession = Depends(get_db)):
    surveyor = Surveyor(**_to_orm_fields(payload.model_dump()))
    db.add(surveyor)
    await db.commit()
    return await get_surveyor_or_404(surveyor.id, db)


@router.get("/", response_model=list[SurveyorOut])
async def list_surveyors(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    query = select(Surveyor).options(selectinload(Surveyor.coverage))
    if active_only:
        query = query.where(Surveyor.is_active == True)
    result = await db.execute(query.order_by(
        Surveyor.surveyor_number.cast(Integer).asc().nulls_last()
    ))
    return result.scalars().all()


@router.get("/{id}", response_model=SurveyorDetail)
async def get_surveyor(id: int, db: AsyncSession = Depends(get_db)):
    return await get_surveyor_or_404(id, db)


@router.patch("/{id}", response_model=SurveyorDetail)
async def update_surveyor(
    id: int,
    payload: SurveyorUpdate,
    db: AsyncSession = Depends(get_db),
):
    surveyor = await get_surveyor_or_404(id, db)
    updates = _to_orm_fields(payload.model_dump(exclude_unset=True))
    for field, value in updates.items():
        setattr(surveyor, field, value)
    await db.commit()

    # Sync work_types, fee_cat, base_postcode back to all postcode coverage rows
    sync_fields = {k for k in ('work_types', 'fee_cat', 'base_postcode') if k in updates}
    if sync_fields and surveyor.surveyor_number:
        result = await db.execute(
            select(PostcodeSurveyor).where(PostcodeSurveyor.surveyor_number == surveyor.surveyor_number)
        )
        postcode_rows = result.scalars().all()
        for row in postcode_rows:
            for field in sync_fields:
                setattr(row, field, getattr(surveyor, field))
        if postcode_rows:
            await db.commit()

    return await get_surveyor_or_404(id, db)


@router.delete("/{id}", status_code=204)
async def delete_surveyor(id: int, db: AsyncSession = Depends(get_db)):
    surveyor = await db.get(Surveyor, id)
    if not surveyor:
        raise HTTPException(status_code=404, detail="Surveyor not found")
    surveyor.is_active = False
    await db.commit()


@router.post("/{id}/restore", response_model=SurveyorDetail)
async def restore_surveyor(id: int, db: AsyncSession = Depends(get_db)):
    surveyor = await get_surveyor_or_404(id, db)
    surveyor.is_active = True
    await db.commit()
    return await get_surveyor_or_404(id, db)


# ---------------------------------------------------------------------------
# Relationship management — replace-all style
# ---------------------------------------------------------------------------

class CoverageEntry(BaseModel):
    code: str
    distance_band: str | None = None  # '15', '25', '25+'

class CoveragePayload(BaseModel):
    outward_codes: list[str] = []          # legacy / simple path (no band)
    coverage: list[CoverageEntry] = []     # preferred: [{code, distance_band}]

class SurveyTypesPayload(BaseModel):
    survey_type_ids: list[int]

class ClientExclusionsPayload(BaseModel):
    client_ids: list[int]


@router.put("/{id}/coverage", response_model=SurveyorDetail)
async def set_coverage(id: int, payload: CoveragePayload, db: AsyncSession = Depends(get_db)):
    surveyor = await get_surveyor_or_404(id, db)
    # Delete existing and replace
    await db.execute(
        select(SurveyorCoverage).where(SurveyorCoverage.surveyor_id == id)
    )
    for cov in list(surveyor.coverage):
        await db.delete(cov)
    await db.flush()
    # Accept either the structured coverage list or the legacy outward_codes list
    if payload.coverage:
        seen = set()
        for entry in payload.coverage:
            code = entry.code.strip().upper()
            if code and code not in seen:
                seen.add(code)
                db.add(SurveyorCoverage(surveyor_id=id, outward_code=code, distance_band=entry.distance_band))
    else:
        codes = [c.strip().upper() for c in payload.outward_codes if c.strip()]
        for code in dict.fromkeys(codes):  # preserve order, dedupe
            db.add(SurveyorCoverage(surveyor_id=id, outward_code=code))
    await db.commit()
    return await get_surveyor_or_404(id, db)


@router.put("/{id}/survey-types", response_model=SurveyorDetail)
async def set_survey_types(id: int, payload: SurveyTypesPayload, db: AsyncSession = Depends(get_db)):
    surveyor = await get_surveyor_or_404(id, db)
    for q in list(surveyor.qualifications):
        await db.delete(q)
    await db.flush()
    for st_id in set(payload.survey_type_ids):
        db.add(SurveyorQualification(surveyor_id=id, survey_type_id=st_id))
    await db.commit()
    return await get_surveyor_or_404(id, db)


@router.put("/{id}/client-exclusions", response_model=SurveyorDetail)
async def set_client_exclusions(id: int, payload: ClientExclusionsPayload, db: AsyncSession = Depends(get_db)):
    surveyor = await get_surveyor_or_404(id, db)
    for e in list(surveyor.client_exclusions):
        await db.delete(e)
    await db.flush()
    for client_id in set(payload.client_ids):
        db.add(SurveyorClientExclusion(surveyor_id=id, client_id=client_id))
    await db.commit()
    return await get_surveyor_or_404(id, db)
