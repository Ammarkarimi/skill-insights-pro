"""Job-market insights.

Live numbers (job counts, salaries, salary history, top employers) come from the Adzuna API
when ADZUNA_APP_ID / ADZUNA_APP_KEY are configured. Qualitative insights come from the LLM and
are always labelled as AI estimates in the UI; the app never presents invented numbers as data.
"""

from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

import httpx
from pydantic import BaseModel, Field

from ..config import get_settings
from ..llm import generate

log = logging.getLogger(__name__)

COUNTRIES = {
    "us": ("United States", "USD"), "gb": ("United Kingdom", "GBP"), "in": ("India", "INR"),
    "ca": ("Canada", "CAD"), "au": ("Australia", "AUD"), "de": ("Germany", "EUR"),
    "fr": ("France", "EUR"), "nl": ("Netherlands", "EUR"), "sg": ("Singapore", "SGD"),
    "nz": ("New Zealand", "NZD"), "za": ("South Africa", "ZAR"), "br": ("Brazil", "BRL"),
    "pl": ("Poland", "PLN"), "it": ("Italy", "EUR"), "es": ("Spain", "EUR"),
    "mx": ("Mexico", "MXN"), "at": ("Austria", "EUR"), "be": ("Belgium", "EUR"),
    "ch": ("Switzerland", "CHF"),
}

_CACHE_TTL = 6 * 3600
_cache: dict[tuple[str, str], tuple[float, dict]] = {}
_cache_lock = threading.Lock()


def cached(country: str, skill: str) -> dict | None:
    with _cache_lock:
        hit = _cache.get((country, skill.lower()))
        if hit and time.time() - hit[0] < _CACHE_TTL:
            return hit[1]
    return None


def _store(country: str, skill: str, data: dict) -> None:
    with _cache_lock:
        _cache[(country, skill.lower())] = (time.time(), data)


# ---------------------------------------------------------------- Adzuna (live data)
def _adzuna_get(client: httpx.Client, country: str, path: str, **params) -> dict | None:
    settings = get_settings()
    try:
        resp = client.get(
            f"https://api.adzuna.com/v1/api/jobs/{country}/{path}",
            params={"app_id": settings.adzuna_app_id, "app_key": settings.adzuna_app_key,
                    "content-type": "application/json", **params},
        )
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Adzuna %s failed: %s", path, exc)
        return None


def fetch_live(skill: str, country: str) -> dict | None:
    with httpx.Client(timeout=10.0) as client, ThreadPoolExecutor(max_workers=4) as pool:
        f_search = pool.submit(_adzuna_get, client, country, "search/1", what=skill,
                               results_per_page=1)
        f_geo = pool.submit(_adzuna_get, client, country, "geodata", what=skill)
        f_hist = pool.submit(_adzuna_get, client, country, "history", what=skill, months=12)
        f_top = pool.submit(_adzuna_get, client, country, "top_companies", what=skill)
        search, geo, hist, top = f_search.result(), f_geo.result(), f_hist.result(), f_top.result()

    if not search:
        return None
    locations = sorted(
        ({"name": loc.get("location", {}).get("display_name", "Unknown"),
          "jobs": int(loc.get("count", 0))} for loc in (geo or {}).get("locations", [])),
        key=lambda x: x["jobs"], reverse=True,
    )[:10]
    history = [{"month": m, "salary": round(float(v))}
               for m, v in sorted((hist or {}).get("month", {}).items()) if v]
    companies = [{"name": c.get("canonical_name", ""), "jobs": int(c.get("count", 0)),
                  "averageSalary": round(float(c.get("average_salary") or 0))}
                 for c in (top or {}).get("leaderboard", [])[:8]]
    return {
        "totalJobs": int(search.get("count", 0)),
        "averageSalary": round(float(search.get("mean") or 0)) or None,
        "locations": locations,
        "salaryHistory": history,
        "topCompanies": companies,
    }


# ---------------------------------------------------------------- AI insights
class RelatedSkill(BaseModel):
    name: str
    reason: str


class IndustryShare(BaseModel):
    name: str
    share: int = Field(description="Approximate percent of demand; all shares sum to ~100")


class HiringHub(BaseModel):
    city: str
    demand: Literal["Very high", "High", "Moderate"]
    note: str


class SalaryBands(BaseModel):
    entry: str
    mid: str
    senior: str


class MarketInsightsLLM(BaseModel):
    summary: str = Field(description="3-4 sentence overview of demand for this skill")
    demandLevel: Literal["Very high", "High", "Moderate", "Low"]
    outlook: str = Field(description="1-2 sentence 12-24 month outlook")
    salaryBands: SalaryBands = Field(description="Annual ranges in local currency, with symbol")
    hiringHubs: list[HiringHub] = Field(description="5-8 cities with the most demand")
    industries: list[IndustryShare] = Field(description="5-7 industries")
    relatedSkills: list[RelatedSkill] = Field(description="6-8 complementary skills to learn")
    topRoles: list[str] = Field(description="5 job titles that most often require this skill")
    tips: list[str] = Field(description="3 tips for job seekers with this skill")


MARKET_SYSTEM = """You are a labour-market analyst for technology jobs. Give your best-informed, \
realistic estimates based on your knowledge of hiring trends. Be honest about uncertainty. \
Salaries must be realistic annual gross ranges for the given country in its local currency. \
If live data is provided, keep your narrative consistent with it."""


def insights(skill: str, country: str, live: dict | None, user_id: int) -> dict:
    name, currency = COUNTRIES[country]
    live_note = ""
    if live:
        live_note = (f"\nLive data: {live['totalJobs']} open postings; average advertised salary "
                     f"{live['averageSalary']} {currency}; top locations: "
                     + ", ".join(f"{loc['name']} ({loc['jobs']})" for loc in live["locations"][:5]))
    llm = generate(MarketInsightsLLM, system=MARKET_SYSTEM, user_id=user_id,
                   prompt=f"Skill: {skill}\nCountry: {name} (currency {currency}){live_note}")
    return llm.model_dump()


def market_report(skill: str, country: str, user_id: int) -> dict:
    settings = get_settings()
    live = fetch_live(skill, country) if settings.adzuna_enabled else None
    report = {
        "skill": skill,
        "country": country,
        "countryName": COUNTRIES[country][0],
        "currency": COUNTRIES[country][1],
        "live": live,
        "liveSource": "Adzuna" if live else None,
        "insights": insights(skill, country, live, user_id),
        "generatedAt": int(time.time()),
    }
    _store(country, skill, report)
    return report
