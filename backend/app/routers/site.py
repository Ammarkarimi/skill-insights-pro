"""Public site settings: runtime config for the frontend (no secrets), the served index.html,
robots.txt and sitemap.xml. Keys and contact details change without a rebuild."""

from __future__ import annotations

import html
import re

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import get_db
from ..models import Portfolio

router = APIRouter(tags=["site"])
PUBLIC_PAGES = ("/", "/register", "/login", "/terms", "/privacy", "/refunds")


@router.get("/api/config")
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


def company(s: Settings) -> str:
    return s.company_name or s.app_name


def render_index(index_html: str, s: Settings) -> str:
    """Fill in contact details and make link-preview URLs absolute (crawlers need full URLs)."""
    base = s.app_url.rstrip("/")
    page = re.sub(r'(<meta property="og:image" content=")/', lambda m: f"{m.group(1)}{base}/", index_html)
    tags = (f'<meta name="ss:company" content="{html.escape(company(s))}"/>'
            f'<meta name="ss:support-email" content="{html.escape(s.support_email)}"/>'
            f'<meta property="og:site_name" content="{html.escape(s.app_name)}"/>')
    return page.replace("</head>", tags + "</head>", 1)


@router.get("/robots.txt", include_in_schema=False)
def robots() -> Response:
    base = get_settings().app_url.rstrip("/")
    body = (f"User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /billing\nDisallow: /settings\n\n"
            f"Sitemap: {base}/sitemap.xml\n")
    return Response(body, media_type="text/plain", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/sitemap.xml", include_in_schema=False)
def sitemap(db: Session = Depends(get_db)) -> Response:
    base = get_settings().app_url.rstrip("/")
    urls = [f"{base}{p}" for p in PUBLIC_PAGES]
    # Only portfolios whose owners chose to be found in search.
    urls += [f"{base}/p/{slug}" for slug in db.scalars(
        select(Portfolio.slug).where(Portfolio.is_published, Portfolio.allow_indexing).limit(5000))]
    body = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "".join(f"  <url><loc>{html.escape(u)}</loc></url>\n" for u in urls) + "</urlset>\n")
    return Response(body, media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})
