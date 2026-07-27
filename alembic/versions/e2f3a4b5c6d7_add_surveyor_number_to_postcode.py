"""add surveyor_number to postcode_surveyors

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('postcode_surveyors', sa.Column('surveyor_number', sa.Text(), nullable=True))
    # Populate from existing name field — extract number from e.g. "John Smith (329)"
    op.execute(r"""
        UPDATE postcode_surveyors
        SET surveyor_number = (regexp_match(name, '\(([^)]*\d[^)]*)\)'))[1]
        WHERE name ~ '\([^)]*\d[^)]*\)'
    """)


def downgrade():
    op.drop_column('postcode_surveyors', 'surveyor_number')
