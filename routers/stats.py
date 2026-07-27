from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date, and_
from pydantic import BaseModel

from core.database import get_db
from models.orm import Client, Instruction, InstructionStatus

router = APIRouter(prefix="/stats", tags=["stats"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class OverviewOut(BaseModel):
    instruction_count: int
    total_client_fee: float
    total_surveyor_fee: float
    margin: float


class DailyRow(BaseModel):
    day: date
    instruction_count: int
    total_client_fee: float
    total_surveyor_fee: float
    margin: float


class ClientRow(BaseModel):
    client_id: int
    client_name: str
    instruction_count: int
    total_client_fee: float
    total_surveyor_fee: float
    margin: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_filters(date_from: date, date_to: date, client_ids: list[int]) -> list:
    # extract('dow', ...) returns 0=Sunday, 6=Saturday in PostgreSQL
    conds = [
        cast(Instruction.received_at, Date) >= date_from,
        cast(Instruction.received_at, Date) <= date_to,
        Instruction.status != InstructionStatus.cancelled,
    ]
    if client_ids:
        conds.append(Instruction.client_id.in_(client_ids))
    return conds


def _margin_expr():
    """Sum of (client_fee - surveyor_fee), treating NULLs as 0."""
    return func.coalesce(
        func.sum(
            func.coalesce(Instruction.agreed_client_fee, 0)
            - func.coalesce(Instruction.agreed_surveyor_fee, 0)
        ),
        0,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/overview", response_model=OverviewOut)
async def overview(
    date_from: date,
    date_to: date,
    client_id: list[int] = Query(default=[]),
    db: AsyncSession = Depends(get_db),
):
    q = select(
        func.count(Instruction.id).label("cnt"),
        func.coalesce(func.sum(Instruction.agreed_client_fee), 0).label("tcf"),
        func.coalesce(func.sum(Instruction.agreed_surveyor_fee), 0).label("tsf"),
        _margin_expr().label("margin"),
    ).where(and_(*_base_filters(date_from, date_to, client_id)))

    row = (await db.execute(q)).one()
    return OverviewOut(
        instruction_count=row.cnt,
        total_client_fee=float(row.tcf),
        total_surveyor_fee=float(row.tsf),
        margin=float(row.margin),
    )


@router.get("/daily", response_model=list[DailyRow])
async def daily(
    date_from: date,
    date_to: date,
    client_id: list[int] = Query(default=[]),
    db: AsyncSession = Depends(get_db),
):
    day_col = cast(Instruction.received_at, Date).label("day")
    q = (
        select(
            day_col,
            func.count(Instruction.id).label("cnt"),
            func.coalesce(func.sum(Instruction.agreed_client_fee), 0).label("tcf"),
            func.coalesce(func.sum(Instruction.agreed_surveyor_fee), 0).label("tsf"),
            _margin_expr().label("margin"),
        )
        .where(and_(*_base_filters(date_from, date_to, client_id)))
        .group_by(day_col)
        .order_by(day_col)
    )

    rows = (await db.execute(q)).all()
    return [
        DailyRow(
            day=row.day,
            instruction_count=row.cnt,
            total_client_fee=float(row.tcf),
            total_surveyor_fee=float(row.tsf),
            margin=float(row.margin),
        )
        for row in rows
    ]


@router.get("/by-client", response_model=list[ClientRow])
async def by_client(
    date_from: date,
    date_to: date,
    db: AsyncSession = Depends(get_db),
):
    margin_sum = _margin_expr()
    q = (
        select(
            Instruction.client_id,
            Client.company_name,
            func.count(Instruction.id).label("cnt"),
            func.coalesce(func.sum(Instruction.agreed_client_fee), 0).label("tcf"),
            func.coalesce(func.sum(Instruction.agreed_surveyor_fee), 0).label("tsf"),
            margin_sum.label("margin"),
        )
        .join(Client, Instruction.client_id == Client.id)
        .where(and_(
            cast(Instruction.received_at, Date) >= date_from,
            cast(Instruction.received_at, Date) <= date_to,
            Instruction.status != InstructionStatus.cancelled,
        ))
        .group_by(Instruction.client_id, Client.company_name)
        .order_by(margin_sum.desc())
    )

    rows = (await db.execute(q)).all()
    return [
        ClientRow(
            client_id=row.client_id,
            client_name=row.company_name,
            instruction_count=row.cnt,
            total_client_fee=float(row.tcf),
            total_surveyor_fee=float(row.tsf),
            margin=float(row.margin),
        )
        for row in rows
    ]
