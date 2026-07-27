from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models.orm import Instruction, InstructionStatus, InstructionStatusHistory, STATUS_TRANSITIONS


class InvalidStatusTransition(Exception):
    pass


async def generate_ref(db: AsyncSession) -> str:
    """Generate a sequential reference in the format TWS-YYYY-NNNN."""
    year = datetime.now().year
    result = await db.execute(
        select(func.count()).select_from(Instruction).where(
            func.extract("year", Instruction.received_at) == year
        )
    )
    count = result.scalar() + 1
    return f"TWS-{year}-{count:04d}"


async def transition_status(
    db: AsyncSession,
    instruction: Instruction,
    new_status: InstructionStatus,
    changed_by: str,
    notes: str | None = None,
) -> Instruction:
    """
    Validate and apply a status transition.
    Writes a history row and sets derived timestamps automatically.
    Raises InvalidStatusTransition if the move is not allowed.
    """
    allowed = STATUS_TRANSITIONS.get(instruction.status, set())
    if new_status not in allowed:
        raise InvalidStatusTransition(
            f"Cannot move from '{instruction.status.value}' to '{new_status.value}'. "
            f"Allowed: {[s.value for s in allowed] or 'none'}"
        )

    history = InstructionStatusHistory(
        instruction_id=instruction.id,
        old_status=instruction.status,
        new_status=new_status,
        changed_by=changed_by,
        notes=notes,
    )
    db.add(history)

    instruction.status = new_status

    now = datetime.now(timezone.utc)
    if new_status == InstructionStatus.report_received:
        instruction.report_received_at = now
    elif new_status == InstructionStatus.invoiced:
        instruction.invoiced_at = now
    elif new_status == InstructionStatus.complete:
        instruction.completed_at = now

    await db.commit()
    await db.refresh(instruction)
    return instruction
