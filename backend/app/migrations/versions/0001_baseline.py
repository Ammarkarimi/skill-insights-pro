"""Baseline: the schema as of Phase 5.

Creates every table that does not exist yet, so databases made by `create_all` before
migrations existed are adopted without changes.

Revision ID: 0001
Revises:
Create Date: 2026-10-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def _missing(table: str) -> bool:
    # Databases made by create_all before migrations existed already have some (or all) tables.
    return not sa.inspect(op.get_bind()).has_table(table)


def upgrade() -> None:
    if _missing('users'):
        op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('password_hash', sa.String(length=200), nullable=False),
        sa.Column('credits', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_users_email'), ['email'], unique=True)

    if _missing('applications'):
        op.create_table('applications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('company', sa.String(length=120), nullable=False),
        sa.Column('title', sa.String(length=120), nullable=False),
        sa.Column('job_url', sa.String(length=500), nullable=False),
        sa.Column('job_description', sa.Text(), nullable=False),
        sa.Column('location', sa.String(length=120), nullable=False),
        sa.Column('salary_note', sa.String(length=120), nullable=False),
        sa.Column('contact', sa.String(length=200), nullable=False),
        sa.Column('notes', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('status_history', sa.JSON(), nullable=False),
        sa.Column('next_date', sa.String(length=10), nullable=True),
        sa.Column('next_label', sa.String(length=120), nullable=False),
        sa.Column('checklist', sa.JSON(), nullable=False),
        sa.Column('prep', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('applications', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_applications_user_id'), ['user_id'], unique=False)

    if _missing('aptitude_tests'):
        op.create_table('aptitude_tests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('section', sa.String(length=20), nullable=False),
        sa.Column('difficulty', sa.String(length=20), nullable=False),
        sa.Column('questions', sa.JSON(), nullable=False),
        sa.Column('answers', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deadline_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('aptitude_tests', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_aptitude_tests_user_id'), ['user_id'], unique=False)

    if _missing('assessment_sessions'):
        op.create_table('assessment_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('skills', sa.JSON(), nullable=False),
        sa.Column('difficulty', sa.String(length=20), nullable=False),
        sa.Column('questions', sa.JSON(), nullable=False),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('assessment_sessions', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_assessment_sessions_user_id'), ['user_id'], unique=False)

    if _missing('coding_sessions'):
        op.create_table('coding_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('level', sa.String(length=20), nullable=False),
        sa.Column('slugs', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deadline_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('coding_sessions', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_coding_sessions_user_id'), ['user_id'], unique=False)

    if _missing('email_logs'):
        op.create_table('email_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=30), nullable=False),
        sa.Column('ref', sa.String(length=80), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'kind', 'ref', name='uq_email_once')
        )
        with op.batch_alter_table('email_logs', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_email_logs_user_id'), ['user_id'], unique=False)

    if _missing('email_preferences'):
        op.create_table('email_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('daily', sa.Boolean(), nullable=False),
        sa.Column('weekly', sa.Boolean(), nullable=False),
        sa.Column('timezone', sa.String(length=64), nullable=False),
        sa.Column('send_hour', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
        )

    if _missing('github_accounts'):
        op.create_table('github_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('github_id', sa.BigInteger(), nullable=False),
        sa.Column('login', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('avatar_url', sa.String(length=500), nullable=False),
        sa.Column('connected_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('github_id'),
        sa.UniqueConstraint('user_id')
        )

    if _missing('interview_sessions'):
        op.create_table('interview_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('topic', sa.String(length=200), nullable=False),
        sa.Column('difficulty', sa.String(length=20), nullable=False),
        sa.Column('overall_score', sa.Integer(), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_interview_sessions_user_id'), ['user_id'], unique=False)

    if _missing('negotiations'):
        op.create_table('negotiations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role_title', sa.String(length=120), nullable=False),
        sa.Column('level', sa.String(length=20), nullable=False),
        sa.Column('location', sa.String(length=120), nullable=False),
        sa.Column('company_type', sa.String(length=30), nullable=False),
        sa.Column('scenario', sa.JSON(), nullable=False),
        sa.Column('offer', sa.JSON(), nullable=False),
        sa.Column('transcript', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('report', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('negotiations', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_negotiations_user_id'), ['user_id'], unique=False)

    if _missing('payments'):
        op.create_table('payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=20), nullable=False),
        sa.Column('provider_ref', sa.String(length=255), nullable=False),
        sa.Column('pack_id', sa.String(length=50), nullable=False),
        sa.Column('credits', sa.Integer(), nullable=False),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('provider_ref')
        )
        with op.batch_alter_table('payments', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_payments_user_id'), ['user_id'], unique=False)

    if _missing('portfolios'):
        op.create_table('portfolios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(length=40), nullable=False),
        sa.Column('display_name', sa.String(length=120), nullable=False),
        sa.Column('headline', sa.String(length=160), nullable=False),
        sa.Column('bio', sa.Text(), nullable=False),
        sa.Column('is_published', sa.Boolean(), nullable=False),
        sa.Column('allow_indexing', sa.Boolean(), nullable=False),
        sa.Column('items', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
        )
        with op.batch_alter_table('portfolios', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_portfolios_slug'), ['slug'], unique=True)

    if _missing('practice_logs'):
        op.create_table('practice_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('day', sa.String(length=10), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('practice_logs', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_practice_logs_day'), ['day'], unique=False)
            batch_op.create_index(batch_op.f('ix_practice_logs_user_id'), ['user_id'], unique=False)

    if _missing('project_reviews'):
        op.create_table('project_reviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('repo_full_name', sa.String(length=200), nullable=False),
        sa.Column('repo_url', sa.String(length=300), nullable=False),
        sa.Column('commit_sha', sa.String(length=64), nullable=False),
        sa.Column('ownership', sa.JSON(), nullable=False),
        sa.Column('repo_meta', sa.JSON(), nullable=False),
        sa.Column('review', sa.JSON(), nullable=False),
        sa.Column('overall_score', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('project_reviews', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_project_reviews_user_id'), ['user_id'], unique=False)

    if _missing('proof_assessments'):
        op.create_table('proof_assessments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('skill', sa.String(length=80), nullable=False),
        sa.Column('skill_key', sa.String(length=80), nullable=False),
        sa.Column('pool', sa.JSON(), nullable=False),
        sa.Column('served', sa.JSON(), nullable=False),
        sa.Column('current_tier', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('level', sa.String(length=20), nullable=True),
        sa.Column('proficiency', sa.Integer(), nullable=True),
        sa.Column('focus_lost', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('proof_assessments', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_proof_assessments_skill_key'), ['skill_key'], unique=False)
            batch_op.create_index(batch_op.f('ix_proof_assessments_user_id'), ['user_id'], unique=False)

    if _missing('review_cards'):
        op.create_table('review_cards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('qhash', sa.String(length=64), nullable=False),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('skill', sa.String(length=120), nullable=False),
        sa.Column('question', sa.JSON(), nullable=False),
        sa.Column('box', sa.Integer(), nullable=False),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reviews', sa.Integer(), nullable=False),
        sa.Column('last_correct', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('review_cards', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_review_cards_due_at'), ['due_at'], unique=False)
            batch_op.create_index(batch_op.f('ix_review_cards_qhash'), ['qhash'], unique=False)
            batch_op.create_index(batch_op.f('ix_review_cards_user_id'), ['user_id'], unique=False)

    if _missing('stories'):
        op.create_table('stories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=120), nullable=False),
        sa.Column('situation', sa.Text(), nullable=False),
        sa.Column('task', sa.Text(), nullable=False),
        sa.Column('action', sa.Text(), nullable=False),
        sa.Column('result', sa.Text(), nullable=False),
        sa.Column('themes', sa.JSON(), nullable=False),
        sa.Column('origin', sa.String(length=20), nullable=False),
        sa.Column('coaching', sa.JSON(), nullable=False),
        sa.Column('critique', sa.JSON(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('stories', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_stories_user_id'), ['user_id'], unique=False)

    if _missing('story_drills'):
        op.create_table('story_drills',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('answers', sa.JSON(), nullable=False),
        sa.Column('overall', sa.JSON(), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('story_drills', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_story_drills_user_id'), ['user_id'], unique=False)

    if _missing('target_roles'):
        op.create_table('target_roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=120), nullable=False),
        sa.Column('job_description', sa.Text(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('requirements', sa.JSON(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('target_roles', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_target_roles_user_id'), ['user_id'], unique=False)

    if _missing('usage_events'):
        op.create_table('usage_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('credits', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('usage_events', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_usage_events_user_id'), ['user_id'], unique=False)

    if _missing('coding_attempts'):
        op.create_table('coding_attempts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=True),
        sa.Column('slug', sa.String(length=80), nullable=False),
        sa.Column('language', sa.String(length=20), nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('passed', sa.Integer(), nullable=False),
        sa.Column('total', sa.Integer(), nullable=False),
        sa.Column('late', sa.Boolean(), nullable=False),
        sa.Column('review', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['coding_sessions.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('coding_attempts', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_coding_attempts_slug'), ['slug'], unique=False)
            batch_op.create_index(batch_op.f('ix_coding_attempts_user_id'), ['user_id'], unique=False)

    if _missing('deep_interviews'):
        op.create_table('deep_interviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('target_role_id', sa.Integer(), nullable=True),
        sa.Column('role_title', sa.String(length=120), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('plan', sa.JSON(), nullable=False),
        sa.Column('transcript', sa.JSON(), nullable=False),
        sa.Column('current_topic', sa.Integer(), nullable=False),
        sa.Column('follow_ups', sa.Integer(), nullable=False),
        sa.Column('report', sa.JSON(), nullable=True),
        sa.Column('overall_score', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['target_role_id'], ['target_roles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('deep_interviews', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_deep_interviews_user_id'), ['user_id'], unique=False)

    if _missing('evidence'):
        op.create_table('evidence',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('target_role_id', sa.Integer(), nullable=True),
        sa.Column('requirement_key', sa.String(length=80), nullable=True),
        sa.Column('skill', sa.String(length=120), nullable=False),
        sa.Column('source', sa.String(length=30), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['target_role_id'], ['target_roles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('evidence', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_evidence_created_at'), ['created_at'], unique=False)
            batch_op.create_index(batch_op.f('ix_evidence_target_role_id'), ['target_role_id'], unique=False)
            batch_op.create_index(batch_op.f('ix_evidence_user_id'), ['user_id'], unique=False)

    if _missing('learning_plans'):
        op.create_table('learning_plans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('assessment_session_id', sa.Integer(), nullable=True),
        sa.Column('skills', sa.JSON(), nullable=False),
        sa.Column('difficulty', sa.String(length=20), nullable=False),
        sa.Column('baseline_score', sa.Integer(), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('progress', sa.JSON(), nullable=False),
        sa.Column('retest_session_id', sa.Integer(), nullable=True),
        sa.Column('retest_score', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['assessment_session_id'], ['assessment_sessions.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('learning_plans', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_learning_plans_user_id'), ['user_id'], unique=False)

    if _missing('tailored_resumes'):
        op.create_table('tailored_resumes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('target_role_id', sa.Integer(), nullable=True),
        sa.Column('job_title', sa.String(length=120), nullable=False),
        sa.Column('company', sa.String(length=120), nullable=False),
        sa.Column('job_description', sa.Text(), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('meta', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['target_role_id'], ['target_roles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        with op.batch_alter_table('tailored_resumes', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_tailored_resumes_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('tailored_resumes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_tailored_resumes_user_id'))

    op.drop_table('tailored_resumes')
    with op.batch_alter_table('learning_plans', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_learning_plans_user_id'))

    op.drop_table('learning_plans')
    with op.batch_alter_table('evidence', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_evidence_user_id'))
        batch_op.drop_index(batch_op.f('ix_evidence_target_role_id'))
        batch_op.drop_index(batch_op.f('ix_evidence_created_at'))

    op.drop_table('evidence')
    with op.batch_alter_table('deep_interviews', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_deep_interviews_user_id'))

    op.drop_table('deep_interviews')
    with op.batch_alter_table('coding_attempts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_coding_attempts_user_id'))
        batch_op.drop_index(batch_op.f('ix_coding_attempts_slug'))

    op.drop_table('coding_attempts')
    with op.batch_alter_table('usage_events', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_usage_events_user_id'))

    op.drop_table('usage_events')
    with op.batch_alter_table('target_roles', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_target_roles_user_id'))

    op.drop_table('target_roles')
    with op.batch_alter_table('story_drills', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_story_drills_user_id'))

    op.drop_table('story_drills')
    with op.batch_alter_table('stories', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_stories_user_id'))

    op.drop_table('stories')
    with op.batch_alter_table('review_cards', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_review_cards_user_id'))
        batch_op.drop_index(batch_op.f('ix_review_cards_qhash'))
        batch_op.drop_index(batch_op.f('ix_review_cards_due_at'))

    op.drop_table('review_cards')
    with op.batch_alter_table('proof_assessments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_proof_assessments_user_id'))
        batch_op.drop_index(batch_op.f('ix_proof_assessments_skill_key'))

    op.drop_table('proof_assessments')
    with op.batch_alter_table('project_reviews', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_project_reviews_user_id'))

    op.drop_table('project_reviews')
    with op.batch_alter_table('practice_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_practice_logs_user_id'))
        batch_op.drop_index(batch_op.f('ix_practice_logs_day'))

    op.drop_table('practice_logs')
    with op.batch_alter_table('portfolios', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_portfolios_slug'))

    op.drop_table('portfolios')
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_payments_user_id'))

    op.drop_table('payments')
    with op.batch_alter_table('negotiations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_negotiations_user_id'))

    op.drop_table('negotiations')
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_interview_sessions_user_id'))

    op.drop_table('interview_sessions')
    op.drop_table('github_accounts')
    op.drop_table('email_preferences')
    with op.batch_alter_table('email_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_email_logs_user_id'))

    op.drop_table('email_logs')
    with op.batch_alter_table('coding_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_coding_sessions_user_id'))

    op.drop_table('coding_sessions')
    with op.batch_alter_table('assessment_sessions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_assessment_sessions_user_id'))

    op.drop_table('assessment_sessions')
    with op.batch_alter_table('aptitude_tests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_aptitude_tests_user_id'))

    op.drop_table('aptitude_tests')
    with op.batch_alter_table('applications', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_applications_user_id'))

    op.drop_table('applications')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_email'))

    op.drop_table('users')
