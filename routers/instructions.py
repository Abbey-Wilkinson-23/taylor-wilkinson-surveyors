import csv
import io
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.database import get_db
from models.orm import Client, Instruction, InstructionStatus, Property, Surveyor, SurveyorCoverage
from schemas.instruction import (
    InstructionCreate,
    InstructionOut,
    InstructionSummary,
    InstructionUpdate,
    PropertyUpdate,
    StatusTransitionRequest,
)
from services.instruction_service import generate_ref, transition_status, InvalidStatusTransition

router = APIRouter(prefix="/instructions", tags=["instructions"])

# Eagerly load all relationships needed for responses
LOAD_OPTS = [
    selectinload(Instruction.client).selectinload(Client.contacts),
    selectinload(Instruction.contact),
    selectinload(Instruction.property),
    selectinload(Instruction.survey_type),
    selectinload(Instruction.assigned_surveyor).selectinload(Surveyor.coverage),
    selectinload(Instruction.status_history),
]


async def get_instruction_or_404(id: int, db: AsyncSession) -> Instruction:
    result = await db.execute(
        select(Instruction).where(Instruction.id == id).options(*LOAD_OPTS)
    )
    instruction = result.scalar_one_or_none()
    if not instruction:
        raise HTTPException(status_code=404, detail="Instruction not found")
    return instruction


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

@router.post("/", response_model=InstructionOut, status_code=201)
async def create_instruction(
    payload: InstructionCreate,
    db: AsyncSession = Depends(get_db),
):
    prop = Property(**payload.property.model_dump())
    db.add(prop)
    await db.flush()

    ref = await generate_ref(db)

    # Derive initial status from what's been provided
    if payload.inspection_date:
        initial_status = InstructionStatus.booked
    elif payload.assigned_surveyor_id:
        initial_status = InstructionStatus.surveyor_assigned
    else:
        initial_status = InstructionStatus.received

    instruction = Instruction(
        our_ref=ref,
        client_ref=payload.client_ref,
        client_id=payload.client_id,
        contact_id=payload.contact_id,
        property_id=prop.id,
        survey_type_id=payload.survey_type_id,
        borrower_name=payload.borrower_name,
        borrower_phone=payload.borrower_phone,
        borrower_email=payload.borrower_email,
        assigned_surveyor_id=payload.assigned_surveyor_id,
        agreed_client_fee=payload.agreed_client_fee,
        agreed_surveyor_fee=payload.agreed_surveyor_fee,
        inspection_date=payload.inspection_date,
        report_due_date=payload.report_due_date,
        priority=payload.priority,
        notes=payload.notes,
        status=initial_status,
    )
    db.add(instruction)
    await db.commit()

    return await get_instruction_or_404(instruction.id, db)


# ---------------------------------------------------------------------------
# List (summary view)
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[InstructionSummary])
async def list_instructions(
    status: list[InstructionStatus] = Query(default=[]),
    client_id: list[int] = Query(default=[]),
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Instruction).options(
        selectinload(Instruction.client),
        selectinload(Instruction.survey_type),
        selectinload(Instruction.assigned_surveyor),
        selectinload(Instruction.property),
    )

    if status:
        query = query.where(Instruction.status.in_(status))
    if client_id:
        query = query.where(Instruction.client_id.in_(client_id))
    if date_from:
        query = query.where(Instruction.received_at >= date_from)
    if date_to:
        query = query.where(Instruction.received_at <= date_to)

    query = query.order_by(Instruction.received_at.desc())
    result = await db.execute(query)
    instructions = result.scalars().all()

    return [
        InstructionSummary(
            id=i.id,
            our_ref=i.our_ref,
            client_ref=i.client_ref,
            borrower_name=i.borrower_name,
            status=i.status,
            priority=i.priority,
            received_at=i.received_at,
            inspection_date=i.inspection_date,
            report_due_date=i.report_due_date,
            client_name=i.client.company_name if i.client else None,
            survey_type_name=i.survey_type.name if i.survey_type else None,
            surveyor_name=(
                f"{i.assigned_surveyor.first_name} {i.assigned_surveyor.last_name}"
                if i.assigned_surveyor else None
            ),
            property_address_line_1=i.property.address_line_1 if i.property else None,
            property_postcode=i.property.postcode if i.property else None,
            agreed_client_fee=i.agreed_client_fee,
            agreed_surveyor_fee=i.agreed_surveyor_fee,
        )
        for i in instructions
    ]


# ---------------------------------------------------------------------------
# Report chasers  (must be before /{id} to avoid route conflict)
# ---------------------------------------------------------------------------

# Statuses where the report has NOT yet been received
_OPEN_STATUSES = [
    InstructionStatus.received,
    InstructionStatus.surveyor_assigned,
    InstructionStatus.booked,
]

# How many calendar days before the due date to start chasing, keyed by survey type name
_CHASE_WINDOWS = {
    "Mortgage Valuation": 1,
    "GDV": 2,
}


@router.get("/chasers", response_model=list[InstructionSummary])
async def report_chasers(db: AsyncSession = Depends(get_db)):
    """
    Returns instructions whose reports need chasing:
    - MV: due tomorrow or overdue
    - GDV: due within 2 days or overdue
    Excludes instructions where report has already been received.
    """
    query = (
        select(Instruction)
        .options(
            selectinload(Instruction.client),
            selectinload(Instruction.survey_type),
            selectinload(Instruction.assigned_surveyor),
            selectinload(Instruction.property),
        )
        .where(
            Instruction.status.in_(_OPEN_STATUSES),
            Instruction.report_due_date.isnot(None),
        )
    )
    result = await db.execute(query)
    instructions = result.scalars().all()

    today = date.today()
    chasers = []
    for i in instructions:
        survey_name = i.survey_type.name if i.survey_type else None
        window = _CHASE_WINDOWS.get(survey_name)
        if window is None:
            continue
        if i.report_due_date <= today + timedelta(days=window):
            chasers.append(i)

    chasers.sort(key=lambda i: i.report_due_date)

    return [
        InstructionSummary(
            id=i.id,
            our_ref=i.our_ref,
            client_ref=i.client_ref,
            borrower_name=i.borrower_name,
            status=i.status,
            priority=i.priority,
            received_at=i.received_at,
            inspection_date=i.inspection_date,
            client_name=i.client.company_name if i.client else None,
            survey_type_name=i.survey_type.name if i.survey_type else None,
            surveyor_name=(
                f"{i.assigned_surveyor.first_name} {i.assigned_surveyor.last_name}"
                if i.assigned_surveyor else None
            ),
            property_address_line_1=i.property.address_line_1 if i.property else None,
            property_postcode=i.property.postcode if i.property else None,
            agreed_client_fee=i.agreed_client_fee,
            agreed_surveyor_fee=i.agreed_surveyor_fee,
        )
        for i in chasers
    ]


# ---------------------------------------------------------------------------
# Get one
# ---------------------------------------------------------------------------

@router.get("/{id}", response_model=InstructionOut)
async def get_instruction(id: int, db: AsyncSession = Depends(get_db)):
    return await get_instruction_or_404(id, db)


# ---------------------------------------------------------------------------
# Update fields
# ---------------------------------------------------------------------------

@router.patch("/{id}/property", response_model=InstructionOut)
async def update_property(id: int, payload: PropertyUpdate, db: AsyncSession = Depends(get_db)):
    instruction = await get_instruction_or_404(id, db)
    if not instruction.property:
        raise HTTPException(status_code=404, detail="No property found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(instruction.property, field, value)
    await db.commit()
    return await get_instruction_or_404(id, db)


@router.patch("/{id}", response_model=InstructionOut)
async def update_instruction(
    id: int,
    payload: InstructionUpdate,
    db: AsyncSession = Depends(get_db),
):
    instruction = await get_instruction_or_404(id, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(instruction, field, value)

    await db.commit()
    return await get_instruction_or_404(id, db)


# ---------------------------------------------------------------------------
# Status transition
# ---------------------------------------------------------------------------

@router.patch("/{id}/status", response_model=InstructionOut)
async def update_status(
    id: int,
    payload: StatusTransitionRequest,
    db: AsyncSession = Depends(get_db),
):
    instruction = await get_instruction_or_404(id, db)
    try:
        await transition_status(db, instruction, payload.new_status, payload.changed_by, payload.notes)
    except InvalidStatusTransition as e:
        raise HTTPException(status_code=422, detail=str(e))
    return await get_instruction_or_404(id, db)


@router.post("/{id}/undo-status", response_model=InstructionOut)
async def undo_status(id: int, db: AsyncSession = Depends(get_db)):
    """Revert to the previous status by removing the most recent history entry."""
    instruction = await get_instruction_or_404(id, db)

    history = sorted(instruction.status_history, key=lambda h: h.changed_at)
    if not history:
        raise HTTPException(status_code=400, detail="No status history to undo")

    last = history[-1]
    if last.old_status is None:
        raise HTTPException(status_code=400, detail="Cannot undo the initial status")

    # Revert derived timestamps
    if last.new_status == InstructionStatus.report_received:
        instruction.report_received_at = None
    elif last.new_status == InstructionStatus.invoiced:
        instruction.invoiced_at = None
    elif last.new_status == InstructionStatus.complete:
        instruction.completed_at = None

    instruction.status = last.old_status
    await db.delete(last)
    await db.commit()

    return await get_instruction_or_404(id, db)


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------

@router.get("/export/csv")
async def export_csv(
    client_id: list[int] = Query(default=[], description="Filter by client"),
    date_from: date | None = Query(None, description="Received on or after"),
    date_to: date | None = Query(None, description="Received on or before"),
    db: AsyncSession = Depends(get_db),
):
    """
    Download instructions as a CSV file.
    Excludes all fee information — safe to send to clients.
    """
    query = select(Instruction).options(
        selectinload(Instruction.client),
        selectinload(Instruction.property),
        selectinload(Instruction.survey_type),
        selectinload(Instruction.assigned_surveyor),
    )

    if client_id:
        query = query.where(Instruction.client_id.in_(client_id))
    if date_from:
        query = query.where(Instruction.received_at >= date_from)
    if date_to:
        query = query.where(Instruction.received_at <= date_to)

    query = query.order_by(Instruction.received_at.asc())
    result = await db.execute(query)
    instructions = result.scalars().all()

    def build_address(prop) -> str:
        if not prop:
            return ""
        parts = [
            prop.address_line_1,
            prop.address_line_2,
            prop.town,
            prop.county,
            prop.postcode,
        ]
        return ", ".join(p for p in parts if p)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Our Ref",
        "Client Ref",
        "Borrower Name",
        "Property Address",
        "Postcode",
        "Survey Type",
        "Status",
        "Priority",
        "Received Date",
        "Inspection Date",
        "Report Due Date",
        "Report Received Date",
        "Assigned Surveyor",
        "Notes",
    ])

    for i in instructions:
        writer.writerow([
            i.our_ref,
            i.client_ref or "",
            i.borrower_name,
            build_address(i.property),
            i.property.postcode if i.property else "",
            i.survey_type.name if i.survey_type else "",
            i.status.value,
            i.priority,
            i.received_at.date().isoformat() if i.received_at else "",
            i.inspection_date.isoformat() if i.inspection_date else "",
            i.report_due_date.isoformat() if i.report_due_date else "",
            i.report_received_at.date().isoformat() if i.report_received_at else "",
            (
                f"{i.assigned_surveyor.first_name} {i.assigned_surveyor.last_name}"
                if i.assigned_surveyor else ""
            ),
            i.notes or "",
        ])

    output.seek(0)

    filename = "instructions"
    if date_from:
        filename += f"_{date_from}"
    if date_to:
        filename += f"_to_{date_to}"
    filename += ".csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
