"""make borrower_name nullable

Revision ID: a1b2c3d4e5f6
Revises: f3a4b5c6d7e8
Create Date: 2026-07-27
"""
from alembic import op

revision = 'a1b2c3d4e5f6'
down_revision = 'f3a4b5c6d7e8'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('instructions', 'borrower_name', nullable=True)


def downgrade():
    op.alter_column('instructions', 'borrower_name', nullable=False)
