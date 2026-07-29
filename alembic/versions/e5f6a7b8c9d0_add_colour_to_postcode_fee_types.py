"""add colour to postcode_fee_types

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-29
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None

SEED_COLOURS = {
    'Standard fee scale':    'green',
    'Quotable work only':    'red',
    'Higher / fix / min fee':'gold',
}


def upgrade():
    op.add_column('postcode_fee_types', sa.Column('colour', sa.Text(), nullable=True))
    for name, colour in SEED_COLOURS.items():
        op.execute(
            sa.text("UPDATE postcode_fee_types SET colour = :colour WHERE name = :name")
            .bindparams(colour=colour, name=name)
        )


def downgrade():
    op.drop_column('postcode_fee_types', 'colour')
