"""remove inspection_complete status

Revision ID: c9f2d3e4a5b6
Revises: b3e9a1c2d4f5
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'c9f2d3e4a5b6'
down_revision: Union[str, None] = 'b3e9a1c2d4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_VALUES = ('received', 'surveyor_assigned', 'booked', 'inspection_complete',
              'report_received', 'invoiced', 'complete', 'on_hold', 'cancelled')
NEW_VALUES = ('received', 'surveyor_assigned', 'booked',
              'report_received', 'invoiced', 'complete', 'on_hold', 'cancelled')


def upgrade() -> None:
    # Migrate any inspection_complete instructions/history to report_received
    op.execute("""
        UPDATE instructions
        SET status = 'report_received'
        WHERE status = 'inspection_complete'
    """)
    op.execute("""
        UPDATE instruction_status_history
        SET old_status = 'report_received'
        WHERE old_status = 'inspection_complete'
    """)
    op.execute("""
        UPDATE instruction_status_history
        SET new_status = 'report_received'
        WHERE new_status = 'inspection_complete'
    """)

    # Recreate the enum without inspection_complete
    op.execute("ALTER TYPE instruction_status RENAME TO instruction_status_old")
    op.execute(f"CREATE TYPE instruction_status AS ENUM {NEW_VALUES}")
    op.execute("""
        ALTER TABLE instructions
        ALTER COLUMN status TYPE instruction_status
        USING status::text::instruction_status
    """)
    op.execute("""
        ALTER TABLE instruction_status_history
        ALTER COLUMN old_status TYPE instruction_status
        USING old_status::text::instruction_status
    """)
    op.execute("""
        ALTER TABLE instruction_status_history
        ALTER COLUMN new_status TYPE instruction_status
        USING new_status::text::instruction_status
    """)
    op.execute("DROP TYPE instruction_status_old")


def downgrade() -> None:
    op.execute("ALTER TYPE instruction_status RENAME TO instruction_status_old")
    op.execute(f"CREATE TYPE instruction_status AS ENUM {OLD_VALUES}")
    op.execute("""
        ALTER TABLE instructions
        ALTER COLUMN status TYPE instruction_status
        USING status::text::instruction_status
    """)
    op.execute("""
        ALTER TABLE instruction_status_history
        ALTER COLUMN old_status TYPE instruction_status
        USING old_status::text::instruction_status
    """)
    op.execute("""
        ALTER TABLE instruction_status_history
        ALTER COLUMN new_status TYPE instruction_status
        USING new_status::text::instruction_status
    """)
    op.execute("DROP TYPE instruction_status_old")
