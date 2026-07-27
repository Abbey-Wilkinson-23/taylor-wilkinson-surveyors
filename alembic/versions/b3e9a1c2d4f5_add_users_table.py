"""add users table

Revision ID: b3e9a1c2d4f5
Revises: 711fb21f9064
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b3e9a1c2d4f5'
down_revision: Union[str, None] = '711fb21f9064'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.Text(), nullable=False),
        sa.Column(
            'role',
            sa.Enum('admin', 'user', name='user_role'),
            nullable=False,
            server_default='user',
        ),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )


def downgrade() -> None:
    op.drop_table('users')
    op.execute("DROP TYPE IF EXISTS user_role")
