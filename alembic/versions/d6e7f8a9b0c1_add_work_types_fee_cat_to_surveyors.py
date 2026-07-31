"""add work_types and fee_cat to surveyors

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Branch Labels: None
Depends On: None
"""
import sqlalchemy as sa
from alembic import op

revision = 'd6e7f8a9b0c1'
down_revision = 'c5d6e7f8a9b0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('surveyors', sa.Column('work_types', sa.Text(), nullable=True))
    op.add_column('surveyors', sa.Column('fee_cat', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('surveyors', 'work_types')
    op.drop_column('surveyors', 'fee_cat')
