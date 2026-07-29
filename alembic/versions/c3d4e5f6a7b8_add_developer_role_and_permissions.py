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
    # Add 'developer' to the enum
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'developer'")

    # Add page_permissions column — NULL means "use role defaults"
    op.add_column('users', sa.Column('page_permissions', sa.Text(), nullable=True))

    # Set developer on Abbey's account
    op.execute(
        f"UPDATE users SET role = 'developer', page_permissions = '{ALL_PAGES}' "
        f"WHERE email = '{DEVELOPER_EMAIL}'"
    )


def downgrade():
    op.drop_column('users', 'page_permissions')
