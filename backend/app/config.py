"""Application settings, loaded from environment variables (and `.env` in development)."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class CreditPack(BaseModel):
    id: str
    name: str
    credits: int
    price_cents: int
    description: str = ""
    highlight: bool = False


DEFAULT_PACKS = [
    CreditPack(id="starter", name="Starter", credits=40, price_cents=399,
               description="Try every feature a few times."),
    CreditPack(id="pro", name="Pro", credits=120, price_cents=999,
               description="Best for an active job search.", highlight=True),
    CreditPack(id="power", name="Power", credits=300, price_cents=1999,
               description="For heavy interview prep and recruiters."),
]

# Credits charged per action. Keep in sync with the pricing table shown in the UI
# (the frontend reads it from /api/billing/packs).
DEFAULT_COSTS: dict[str, int] = {
    "chat_message": 1,
    "resume_skills": 1,
    "resume_analysis": 3,
    "assessment_questions": 2,
    "learning_path": 2,
    "interview_questions": 1,
    "interview_evaluation": 3,
    "job_match_per_resume": 2,
    "career_recommendations": 3,
    "market_insights": 2,
    "target_role_setup": 2,
    "deep_interview_start": 3,
    "deep_interview_report": 3,
    "resume_tailor": 4,
    "letter": 1,
    "negotiation_start": 2,
    "negotiation_report": 2,
    "proof_assessment": 3,
    "project_review": 5,
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "production", "test"] = "development"
    app_name: str = "SkillSphere"
    # Public URL of the deployed app, used for Stripe redirect URLs.
    app_url: str = "http://localhost:8080"
    # Extra origins allowed by CORS (only needed when frontend and API are on different hosts).
    cors_origins: str = ""

    database_url: str = "sqlite:///./skillsphere.db"

    jwt_secret: str = "dev-insecure-secret-change-me"
    session_days: int = 7
    cookie_name: str = "ss_session"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"          # high-value artifacts
    openai_model_fast: str = "gpt-5-mini"     # chat + lightweight extraction
    # Set to "" when using a non-reasoning model (e.g. gpt-4.1); otherwise minimal|low|medium|high.
    openai_reasoning_effort: str = "low"
    openai_timeout_seconds: float = 120.0

    # Billing
    free_signup_credits: int = 10
    currency: str = "usd"
    credit_packs: list[CreditPack] = Field(default_factory=lambda: list(DEFAULT_PACKS))
    action_costs: dict[str, int] = Field(default_factory=lambda: dict(DEFAULT_COSTS))
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Optional live job-market data (https://developer.adzuna.com/)
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""

    # GitHub: OAuth app for "Connect GitHub" (callback {APP_URL}/api/github/callback) and an
    # optional server token that raises API rate limits for project reviews.
    github_client_id: str = ""
    github_client_secret: str = ""
    github_token: str = ""

    # Limits
    max_upload_mb: int = 5
    max_job_match_resumes: int = 10
    ai_requests_per_minute: int = 20
    auth_attempts_per_minute: int = 10

    serve_frontend: bool = True
    frontend_dist: str = "../client/dist"

    @field_validator("credit_packs", mode="before")
    @classmethod
    def _parse_packs(cls, v):
        if isinstance(v, str) and v.strip():
            return json.loads(v)
        return v or list(DEFAULT_PACKS)

    @field_validator("action_costs", mode="before")
    @classmethod
    def _merge_costs(cls, v):
        if isinstance(v, str):
            v = json.loads(v) if v.strip() else {}
        return {**DEFAULT_COSTS, **(v or {})}

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def payments_enabled(self) -> bool:
        return bool(self.stripe_secret_key and self.stripe_webhook_secret)

    @property
    def adzuna_enabled(self) -> bool:
        return bool(self.adzuna_app_id and self.adzuna_app_key)

    @property
    def github_oauth_enabled(self) -> bool:
        return bool(self.github_client_id and self.github_client_secret)

    def cost(self, action: str) -> int:
        return self.action_costs[action]

    def validate_for_production(self) -> None:
        problems = []
        if self.jwt_secret.startswith("dev-insecure") or len(self.jwt_secret) < 32:
            problems.append("JWT_SECRET must be a random string of at least 32 characters")
        if not self.openai_api_key:
            problems.append("OPENAI_API_KEY is required")
        if not self.app_url.startswith("https://"):
            problems.append("APP_URL must be the public https:// URL of the app")
        if problems:
            raise RuntimeError("Invalid production configuration:\n- " + "\n- ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()
