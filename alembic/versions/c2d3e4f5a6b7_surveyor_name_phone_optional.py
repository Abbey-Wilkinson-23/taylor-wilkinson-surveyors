"""make surveyor first_name, last_name, phone optional

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Branch Labels: None
Depends On: None
"""
import sqlalchemy as sa
from alembic import op

revision = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('surveyors', 'first_name', existing_type=sa.Text(), nullable=True)
    op.alter_column('surveyors', 'last_name', existing_type=sa.Text(), nullable=True)
    op.alter_column('surveyors', 'phone', existing_type=sa.Text(), nullable=True)


def downgrade():
    op.alter_column('surveyors', 'first_name', existing_type=sa.Text(), nullable=False)
    op.alter_column('surveyors', 'last_name', existing_type=sa.Text(), nullable=False)
    op.alter_column('surveyors', 'phone', existing_type=sa.Text(), nullable=False)
