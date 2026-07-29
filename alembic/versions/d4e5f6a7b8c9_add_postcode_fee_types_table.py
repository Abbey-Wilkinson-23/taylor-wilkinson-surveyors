"""add postcode_fee_types table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-29
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None

SEED = ['Standard fee scale', 'Quotable work only', 'Higher / fix / min fee']


def upgrade():
    op.create_table(
        'postcode_fee_types',
        sa.Column('id',   sa.Integer(), primary_key=True),
        sa.Column('name', sa.Text(),    nullable=False, unique=True),
    )
    op.bulk_insert(
        sa.table('postcode_fee_types', sa.column('name', sa.Text())),
        [{'name': n} for n in SEED],
    )


def downgrade():
    op.drop_table('postcode_fee_types')
