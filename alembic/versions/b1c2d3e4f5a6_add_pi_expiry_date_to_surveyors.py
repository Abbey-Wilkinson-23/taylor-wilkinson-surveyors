"""add pi_expiry_date to surveyors

Revision ID: b1c2d3e4f5a6
Revises: a7b8c9d0e1f2
Branch Labels: None
Depends On: None
"""
import sqlalchemy as sa
from alembic import op

revision = 'b1c2d3e4f5a6'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('surveyors', sa.Column('pi_expiry_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('surveyors', 'pi_expiry_date')
