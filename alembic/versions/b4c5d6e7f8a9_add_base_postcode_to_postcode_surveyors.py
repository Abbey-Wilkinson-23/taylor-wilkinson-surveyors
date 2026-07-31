"""add base_postcode to postcode_surveyors

Revision ID: b4c5d6e7f8a9
Revises: a1b2c3d4e5f6
Branch Labels: None
Depends On: None
"""
import sqlalchemy as sa
from alembic import op

revision = 'b4c5d6e7f8a9'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('postcode_surveyors', sa.Column('base_postcode', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('postcode_surveyors', 'base_postcode')
