"""Application settings, loaded from environment variables (and `.env` in development)."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class CreditPack(BaseModel):
    id: str
    name: str
    credits: int
    price_cents: int  # in CURRENCY, used by Stripe
    description: str = ""
    highlight: bool = False
    # Local prices for Paddle, in minor units per currency, e.g. {"usd": 999, "gbp": 799}.
    prices: dict[str, int] = Field(default_factory=dict)


# Local prices: GBP, EUR and AUD include VAT/GST (shown as the final price, as UK, EU and
# Australian consumer law expects); USD is before sales tax, as US shoppers expect.
DEFAULT_PACKS = [
    CreditPack(id="starter", name="Starter", credits=40, price_cents=399,
               description="Try every feature a few times.",
               prices={"usd": 399, "gbp": 349, "eur": 399, "aud": 599}),
    CreditPack(id="pro", name="Pro", credits=120, price_cents=999,
               description="Best for an active job search.", highlight=True,
               prices={"usd": 999, "gbp": 799, "eur": 899, "aud": 1499}),
    CreditPack(id="power", name="Power", credits=300, price_cents=1999,
               description="For heavy interview prep and recruiters.",
               prices={"usd": 1999, "gbp": 1599, "eur": 1799, "aud": 2999}),
]

# Rupee micro-packs for Razorpay (UPI, cards, netbanking). Prices are in paise, tax inclusive.
DEFAULT_INR_PACKS = [
    CreditPack(id="inr-mini", name="Mini", credits=15, price_cents=4900,
               description="Try a few features."),
    CreditPack(id="inr-starter", name="Starter", credits=40, price_cents=9900,
               description="Try every feature a few times."),
    CreditPack(id="inr-pro", name="Pro", credits=120, price_cents=24900,
               description="Best for an active job search.", highlight=True),
    CreditPack(id="inr-power", name="Power", credits=300, price_cents=49900,
               description="For placement season."),
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
    "prep_kit": 2,
    "aptitude_test": 2,
    "code_review": 1,
    "story_draft": 2,
    "story_critique": 1,
    "story_drill": 2,
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "production", "test"] = "development"
    app_name: str = "SkillSphere"
    # Shown on the legal pages and in emails. Payment providers check that these are real.
    company_name: str = ""  # legal name of the business; defaults to APP_NAME
    support_email: str = ""
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
    # Paddle (merchant of record: collects and files VAT, GST and US sales tax) for cards, Apple Pay,
    # Google Pay and PayPal in USD, GBP, EUR and AUD. Preferred over Stripe when configured.
    paddle_api_key: str = ""  # pdl_sdbx_apikey_... (sandbox) or pdl_live_apikey_...
    paddle_client_token: str = ""  # test_... or live_..., safe to show in the browser
    paddle_webhook_secret: str = ""  # pdl_ntfset_..., from the notification destination
    paddle_product_id: str = ""  # optional pro_...; otherwise each checkout names its own product
    paddle_tax_category: str = "standard"
    tax_inclusive_currencies: str = "gbp,eur,aud,inr"
    # Razorpay (India: UPI, cards, netbanking) in INR, alongside Stripe.
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    inr_credit_packs: list[CreditPack] = Field(default_factory=lambda: list(DEFAULT_INR_PACKS))

    # Optional live job-market data (https://developer.adzuna.com/)
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""

    # GitHub: OAuth app for "Connect GitHub" (callback {APP_URL}/api/github/callback) and an
    # optional server token that raises API rate limits for project reviews.
    github_client_id: str = ""
    github_client_secret: str = ""
    github_token: str = ""

    # Email over any SMTP provider (SendGrid, SES, Postmark, Mailgun, Resend, Gmail...).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""  # e.g. "SkillSphere <hello@yourdomain.com>"
    smtp_security: Literal["starttls", "ssl", "none"] = "starttls"
    # Shared secret for the hourly reminders job (POST /api/internal/cron/reminders).
    cron_secret: str = ""

    # Signup protection: free credits only after the email is verified, optional Cloudflare
    # Turnstile on the signup form, and a daily cap on signups per IP address.
    require_email_verification: bool = True
    turnstile_site_key: str = ""
    turnstile_secret_key: str = ""
    signups_per_ip_per_day: int = 5
    blocked_email_domains: str = ""  # comma separated, added to the built-in disposable list

    # Analytics and ad conversion tracking. Nothing loads until the visitor accepts cookies.
    ga_measurement_id: str = ""  # Google Analytics 4: G-XXXXXXX
    google_ads_id: str = ""  # AW-XXXXXXXXX
    google_ads_signup_label: str = ""  # conversion label for sign-ups
    google_ads_purchase_label: str = ""  # conversion label for purchases
    meta_pixel_id: str = ""  # digits only

    # Error monitoring (optional): https://sentry.io project DSN.
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.0

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

    @field_validator("inr_credit_packs", mode="before")
    @classmethod
    def _parse_inr_packs(cls, v):
        if isinstance(v, str) and v.strip():
            return json.loads(v)
        return v or list(DEFAULT_INR_PACKS)

    @field_validator("ga_measurement_id", "google_ads_id", "google_ads_signup_label",
                     "google_ads_purchase_label", "meta_pixel_id")
    @classmethod
    def _tracking_id(cls, v: str) -> str:
        # These end up in script URLs in the browser: allow only the characters real ids use.
        v = (v or "").strip()
        if v and not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", v):
            raise ValueError("tracking ids may only contain letters, digits, '-' and '_'")
        return v

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
    def paddle_enabled(self) -> bool:
        return bool(self.paddle_api_key and self.paddle_client_token and self.paddle_webhook_secret)

    @property
    def paddle_sandbox(self) -> bool:
        return self.paddle_api_key.startswith("pdl_sdbx_") or self.paddle_client_token.startswith("test_")

    @property
    def card_provider(self) -> str | None:
        """Who takes card payments: Paddle when configured (it handles tax), else Stripe."""
        if self.paddle_enabled:
            return "paddle"
        return "stripe" if self.payments_enabled else None

    def paddle_currencies(self) -> list[str]:
        """Currencies every pack has a price in (the order of the first pack)."""
        packs = self.credit_packs
        return [c for c in (packs[0].prices if packs else {}) if all(c in p.prices for p in packs)]

    def is_tax_inclusive(self, currency: str) -> bool:
        return currency.lower() in {c.strip().lower() for c in self.tax_inclusive_currencies.split(",")}

    @property
    def razorpay_enabled(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret and self.razorpay_webhook_secret)

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_from)

    @property
    def turnstile_enabled(self) -> bool:
        return bool(self.turnstile_site_key and self.turnstile_secret_key)

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
        if "@" not in self.support_email or self.support_email.endswith("@example.com"):
            problems.append("SUPPORT_EMAIL must be a real address (it is shown on the legal pages)")
        if self.require_email_verification and not self.email_enabled:
            problems.append("SMTP_HOST and SMTP_FROM are needed to verify signups by email "
                            "(or set REQUIRE_EMAIL_VERIFICATION=false)")
        if problems:
            raise RuntimeError("Invalid production configuration:\n- " + "\n- ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()
