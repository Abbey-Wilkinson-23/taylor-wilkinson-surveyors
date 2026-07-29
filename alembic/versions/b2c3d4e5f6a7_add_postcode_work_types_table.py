"""add postcode_work_types table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-29
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

DEFAULTS = [
    'R', 'C', 'GDV', 'Homebuyers', 'HMO', 'Building Survey',
    'Agricultural', 'Private Resi', 'L2', 'L3', 'Land Registry', 'Dilapidations',
]

def upgrade():
    op.create_table(
        'postcode_work_types',
        sa.Column('id',   sa.Integer(), primary_key=True),
        sa.Column('name', sa.Text(),    nullable=False, unique=True),
    )
    op.execute(
        "INSERT INTO postcode_work_types (name) VALUES " +
        ", ".join(f"('{n}')" for n in DEFAULTS)
    )

def downgrade():
    op.drop_table('postcode_work_types')
