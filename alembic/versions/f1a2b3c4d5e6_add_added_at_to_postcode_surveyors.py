"""add added_at to postcode_surveyors

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Branch Labels: None
Depends On: None
"""
import sqlalchemy as sa
from alembic import op

revision = 'f1a2b3c4d5e6'
down_revision = 'e7f8a9b0c1d2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('postcode_surveyors', sa.Column('added_at', sa.TIMESTAMP(timezone=True), nullable=True))


def downgrade():
    op.drop_column('postcode_surveyors', 'added_at')
