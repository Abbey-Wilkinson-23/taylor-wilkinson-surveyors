"""add developer role and page_permissions to users

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-29
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None

DEVELOPER_EMAIL = 'abbeywilkinson123@gmail.com'
ALL_PAGES = 'instructions,clients,surveyors,survey-types,postcode-coverage,stats,users'


def upgrade():
    # Step 1: Add 'developer' to the enum — PostgreSQL requires this runs outside
    # a transaction. Commit the open alembic transaction first, then ALTER TYPE,
    # then the remaining DDL/DML starts a fresh implicit transaction.
    conn = op.get_bind()
    conn.execute(sa.text("COMMIT"))
    conn.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'developer'"))

    # Step 2: Add page_permissions column and update Abbey's account
    op.add_column('users', sa.Column('page_permissions', sa.Text(), nullable=True))
    op.execute(
        f"UPDATE users SET role = 'developer', page_permissions = '{ALL_PAGES}' "
        f"WHERE email = '{DEVELOPER_EMAIL}'"
    )


def downgrade():
    op.drop_column('users', 'page_permissions')
