"""Public runtime configuration for the frontend (no secrets), so keys change without a rebuild."""

from __future__ import annotations

from fastapi import APIRouter, Response

from ..config import get_settings

router = APIRouter(prefix="/api", tags=["site"])


@router.get("/config")
def site_config(response: Response) -> dict:
    s = get_settings()
    response.headers["Cache-Control"] = "public, max-age=300"
    return {
        "appName": s.app_name,
        "freeSignupCredits": s.free_signup_credits,
        "requireEmailVerification": s.require_email_verification,
        "turnstileSiteKey": s.turnstile_site_key if s.turnstile_enabled else "",
        "analytics": {
            "ga4": s.ga_measurement_id,
            "googleAds": s.google_ads_id,
            "googleAdsSignupLabel": s.google_ads_signup_label,
            "googleAdsPurchaseLabel": s.google_ads_purchase_label,
            "metaPixel": s.meta_pixel_id,
        },
    }
