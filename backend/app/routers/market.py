from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ..config import get_settings
from ..credits import charge
from ..db import get_db
from ..models import User
from ..security import current_user
from ..services import market as svc

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/countries")
def countries():
    return {"countries": [{"code": c, "name": n, "currency": cur}
                          for c, (n, cur) in svc.COUNTRIES.items()],
            "liveData": get_settings().adzuna_enabled}


@router.get("/insights")
def insights(response: Response, skill: str = Query(min_length=1, max_length=60),
             country: str = Query(default="us", max_length=2),
             user: User = Depends(current_user), db: Session = Depends(get_db)):
    country = country.lower()
    if country not in svc.COUNTRIES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported country.")
    skill = skill.strip()
    cached = svc.cached(country, skill)
    if cached:  # recently generated reports are free
        response.headers["X-Credits-Remaining"] = str(user.credits)
        return cached
    with charge(db, user, "market_insights", response):
        return svc.market_report(skill, country, user.id)
