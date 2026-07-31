"""add activity tracking to users

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Branch Labels: None
Depends On: None
"""
import sqlalchemy as sa
from alembic import op

revision = 'e7f8a9b0c1d2'
down_revision = 'd6e7f8a9b0c1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('last_login_at',  sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('users', sa.Column('last_active_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('users', sa.Column('last_page',      sa.Text(), nullable=True))


def downgrade():
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'last_active_at')
    op.drop_column('users', 'last_page')
