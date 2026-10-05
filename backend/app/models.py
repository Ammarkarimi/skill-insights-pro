"""Database tables."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    password_hash: Mapped[str] = mapped_column(String(200))
    credits: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Payment(Base):
    """A completed credit purchase. `provider_ref` is unique so webhooks are idempotent."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String(20), default="stripe")
    provider_ref: Mapped[str] = mapped_column(String(255), unique=True)
    pack_id: Mapped[str] = mapped_column(String(50))
    credits: Mapped[int] = mapped_column(Integer)
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UsageEvent(Base):
    """One charged AI action. Useful for support, refunds and cost monitoring."""

    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(50))
    credits: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    topic: Mapped[str] = mapped_column(String(200))
    difficulty: Mapped[str] = mapped_column(String(20))
    overall_score: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AssessmentSession(Base):
    """A generated MCQ assessment. The answer key never leaves the server until submission."""

    __tablename__ = "assessment_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    skills: Mapped[list] = mapped_column(JSON)
    difficulty: Mapped[str] = mapped_column(String(20))
    questions: Mapped[list] = mapped_column(JSON)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TargetRole(Base):
    """The job a user is working towards; its requirement map drives the readiness score."""

    __tablename__ = "target_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    job_description: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    # [{key, name, kind, weight, must_have, aliases}]
    requirements: Mapped[list] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Evidence(Base):
    """One scored observation of a skill (from an assessment, resume, interview...)."""

    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_role_id: Mapped[int | None] = mapped_column(ForeignKey("target_roles.id"), nullable=True,
                                                       index=True)
    requirement_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    skill: Mapped[str] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(String(30))
    score: Mapped[int] = mapped_column(Integer)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class DeepInterview(Base):
    """A turn-based "defend your resume" interview. Stores quoted claims only, never the resume."""

    __tablename__ = "deep_interviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_role_id: Mapped[int | None] = mapped_column(ForeignKey("target_roles.id"), nullable=True)
    role_title: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|ready|completed
    plan: Mapped[list] = mapped_column(JSON)          # topics
    transcript: Mapped[list] = mapped_column(JSON, default=list)
    current_topic: Mapped[int] = mapped_column(Integer, default=0)
    follow_ups: Mapped[int] = mapped_column(Integer, default=0)  # follow-ups asked in current topic
    report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    overall_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TailoredResume(Base):
    """A resume version tailored to one job. Users can edit, export and delete it."""

    __tablename__ = "tailored_resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_role_id: Mapped[int | None] = mapped_column(ForeignKey("target_roles.id"), nullable=True)
    job_title: Mapped[str] = mapped_column(String(120), default="")
    company: Mapped[str] = mapped_column(String(120), default="")
    job_description: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[dict] = mapped_column(JSON)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)  # changes, keywords, warnings
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Negotiation(Base):
    """A salary-negotiation practice session. `scenario` holds the hidden budget ceilings."""

    __tablename__ = "negotiations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role_title: Mapped[str] = mapped_column(String(120))
    level: Mapped[str] = mapped_column(String(20))
    location: Mapped[str] = mapped_column(String(120))
    company_type: Mapped[str] = mapped_column(String(30))
    scenario: Mapped[dict] = mapped_column(JSON)
    offer: Mapped[dict] = mapped_column(JSON)
    transcript: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|final|completed
    report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ProofAssessment(Base):
    """An adaptive, timed skill proof. The question pool (with answers) never leaves the server."""

    __tablename__ = "proof_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    skill: Mapped[str] = mapped_column(String(80))
    skill_key: Mapped[str] = mapped_column(String(80), index=True)  # normalised, for cooldowns
    pool: Mapped[list] = mapped_column(JSON)
    served: Mapped[list] = mapped_column(JSON, default=list)
    current_tier: Mapped[int] = mapped_column(Integer, default=2)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|completed
    level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    proficiency: Mapped[int | None] = mapped_column(Integer, nullable=True)
    focus_lost: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GithubAccount(Base):
    """A verified GitHub identity linked via OAuth. The OAuth token is never stored."""

    __tablename__ = "github_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    login: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200), default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ProjectReview(Base):
    """An AI review of a public repository at a specific commit. Code itself is never stored."""

    __tablename__ = "project_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    repo_full_name: Mapped[str] = mapped_column(String(200))
    repo_url: Mapped[str] = mapped_column(String(300))
    commit_sha: Mapped[str] = mapped_column(String(64))
    ownership: Mapped[dict] = mapped_column(JSON)
    repo_meta: Mapped[dict] = mapped_column(JSON)
    review: Mapped[dict] = mapped_column(JSON)
    overall_score: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Portfolio(Base):
    """A user's public proof page at /p/<slug>. Link-only (noindex) unless they opt in."""

    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120), default="")
    headline: Mapped[str] = mapped_column(String(160), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_indexing: Mapped[bool] = mapped_column(Boolean, default=False)
    items: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Application(Base):
    """A job the user is pursuing, tracked through the hiring stages."""

    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    company: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(120))
    job_url: Mapped[str] = mapped_column(String(500), default="")
    job_description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(120), default="")
    salary_note: Mapped[str] = mapped_column(String(120), default="")
    contact: Mapped[str] = mapped_column(String(200), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="saved")
    status_history: Mapped[list] = mapped_column(JSON, default=list)  # [{status, at}]
    next_date: Mapped[str | None] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD
    next_label: Mapped[str] = mapped_column(String(120), default="")
    checklist: Mapped[dict] = mapped_column(JSON, default=dict)  # {item_key: true}
    prep: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AptitudeTest(Base):
    """A timed aptitude test. Answers are saved one by one so the server enforces the deadline."""

    __tablename__ = "aptitude_tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    section: Mapped[str] = mapped_column(String(20))
    difficulty: Mapped[str] = mapped_column(String(20))
    questions: Mapped[list] = mapped_column(JSON)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)  # {qid: {answer, at}}
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|completed
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CodingSession(Base):
    """A timed mock online assessment: two problems against one deadline."""

    __tablename__ = "coding_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    level: Mapped[str] = mapped_column(String(20))
    slugs: Mapped[list] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|completed
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CodingAttempt(Base):
    """A solution the user ran in their browser. Pass counts are self-reported by the client."""

    __tablename__ = "coding_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("coding_sessions.id"), nullable=True)
    slug: Mapped[str] = mapped_column(String(80), index=True)
    language: Mapped[str] = mapped_column(String(20))
    code: Mapped[str] = mapped_column(Text)
    passed: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    late: Mapped[bool] = mapped_column(Boolean, default=False)
    review: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Story(Base):
    """A STAR story for behavioral interviews, drafted from the resume or written by the user."""

    __tablename__ = "stories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    situation: Mapped[str] = mapped_column(Text, default="")
    task: Mapped[str] = mapped_column(Text, default="")
    action: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str] = mapped_column(Text, default="")
    themes: Mapped[list] = mapped_column(JSON, default=list)
    origin: Mapped[str] = mapped_column(String(20), default="manual")  # draft|manual
    coaching: Mapped[dict] = mapped_column(JSON, default=dict)  # {questions, warnings}
    critique: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StoryDrill(Base):
    """One behavioral drill: five questions, the user's answers and the evaluation."""

    __tablename__ = "story_drills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    answers: Mapped[list] = mapped_column(JSON)
    overall: Mapped[dict] = mapped_column(JSON)
    score: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LearningPlan(Base):
    """A saved learning path, with week-by-week progress and an optional re-test."""

    __tablename__ = "learning_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    assessment_session_id: Mapped[int | None] = mapped_column(ForeignKey("assessment_sessions.id"),
                                                               nullable=True)
    skills: Mapped[list] = mapped_column(JSON)
    difficulty: Mapped[str] = mapped_column(String(20))
    baseline_score: Mapped[int] = mapped_column(Integer)
    content: Mapped[dict] = mapped_column(JSON)
    progress: Mapped[dict] = mapped_column(JSON, default=dict)  # {weeks: [n], resources: [url]}
    retest_session_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retest_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|completed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReviewCard(Base):
    """A question the user got wrong, scheduled for spaced repetition (Leitner boxes 1-5)."""

    __tablename__ = "review_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    qhash: Mapped[str] = mapped_column(String(64), index=True)
    source: Mapped[str] = mapped_column(String(20))  # assessment|proof|aptitude
    skill: Mapped[str] = mapped_column(String(120), default="")
    question: Mapped[dict] = mapped_column(JSON)
    box: Mapped[int] = mapped_column(Integer, default=1)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    reviews: Mapped[int] = mapped_column(Integer, default=0)
    last_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PracticeLog(Base):
    """Practice done on a day (UTC), by kind. Drives the streak and the weekly goal."""

    __tablename__ = "practice_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD
    kind: Mapped[str] = mapped_column(String(20))
    count: Mapped[int] = mapped_column(Integer, default=0)
