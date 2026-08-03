"""drop surveyor_qualifications (Types of Work — duplicated by Work Types)

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Branch Labels: None
Depends On: None
"""
import sqlalchemy as sa
from alembic import op

revision = 'a7b8c9d0e1f2'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('surveyor_qualifications')


def downgrade():
    op.create_table(
        'surveyor_qualifications',
        sa.Column('surveyor_id', sa.Integer(), sa.ForeignKey('surveyors.id'), primary_key=True),
        sa.Column('survey_type_id', sa.Integer(), sa.ForeignKey('survey_types.id'), primary_key=True),
    )
