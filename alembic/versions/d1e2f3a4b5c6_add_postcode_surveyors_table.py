"""add postcode_surveyors table

Revision ID: d1e2f3a4b5c6
Revises: c9f2d3e4a5b6
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa

revision = 'd1e2f3a4b5c6'
down_revision = 'c9f2d3e4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'postcode_surveyors',
        sa.Column('id',            sa.Integer(),                             nullable=False),
        sa.Column('postcode_area', sa.Text(),                                nullable=False),
        sa.Column('name',          sa.Text(),                                nullable=False),
        sa.Column('preferred',     sa.Text(),    server_default='',          nullable=False),
        sa.Column('coverage',      sa.Text(),    server_default='',          nullable=False),
        sa.Column('work_types',    sa.Text(),    server_default='',          nullable=False),
        sa.Column('fee_cat',       sa.Text(),                                nullable=False),
        sa.Column('is_custom',     sa.Boolean(), server_default='false',     nullable=False),
        sa.Column('created_at',    sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_postcode_surveyors_area', 'postcode_surveyors', ['postcode_area'])


def downgrade():
    op.drop_index('ix_postcode_surveyors_area', table_name='postcode_surveyors')
    op.drop_table('postcode_surveyors')
