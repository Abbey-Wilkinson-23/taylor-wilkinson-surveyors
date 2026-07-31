"""add base_postcode to surveyors

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Branch Labels: None
Depends On: None
"""
import sqlalchemy as sa
from alembic import op

revision = 'c5d6e7f8a9b0'
down_revision = 'b4c5d6e7f8a9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('surveyors', sa.Column('base_postcode', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('surveyors', 'base_postcode')
