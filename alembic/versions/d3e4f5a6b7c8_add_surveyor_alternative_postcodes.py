"""add surveyor_alternative_postcodes table

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Branch Labels: None
Depends On: None
"""
import sqlalchemy as sa
from alembic import op

revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'surveyor_alternative_postcodes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('surveyor_id', sa.Integer(), sa.ForeignKey('surveyors.id'), nullable=False),
        sa.Column('postcode', sa.Text(), nullable=False),
        sa.Column('type', sa.Text(), nullable=True),  # 'home' | 'work'
    )


def downgrade():
    op.drop_table('surveyor_alternative_postcodes')
