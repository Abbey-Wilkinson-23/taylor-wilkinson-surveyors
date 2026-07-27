"""populate complex surveyor numbers

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-07-27
"""
from alembic import op

revision = 'f3a4b5c6d7e8'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade():
    # Fill in surveyor_number for rows that have complex formats like
    # "(160-169)", "(758, 761 & 774)" that were left NULL previously
    op.execute(r"""
        UPDATE postcode_surveyors
        SET surveyor_number = (regexp_match(name, '\(([^)]*\d[^)]*)\)'))[1]
        WHERE surveyor_number IS NULL
          AND name ~ '\([^)]*\d[^)]*\)'
    """)


def downgrade():
    pass
