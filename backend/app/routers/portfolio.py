"""Skill Proof Portfolio: private settings, the public page payload, badges and share metadata."""

from __future__ import annotations

import html
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Evidence, Portfolio, ProjectReview, ProofAssessment, User, utcnow
from ..security import current_user
from ..services import readiness
from .github import account_for
from .projects import view as review_view

router = APIRouter(tags=["portfolio"])

SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$")
RESERVED = {"admin", "api", "app", "login", "register", "portfolio", "p", "www", "support", "help",
            "billing", "settings", "skillsphere", "about", "terms", "privacy", "refunds", "home"}
NOINDEX = {"X-Robots-Tag": "noindex, nofollow"}


def _suggest_slug(user: User) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (user.name or user.email.split("@")[0]).lower()).strip("-")
    return (base or "me")[:30]


def _settings_view(p: Portfolio | None, user: User) -> dict:
    items = (p.items if p else None) or {}
    return {
        "slug": p.slug if p else _suggest_slug(user),
        "displayName": p.display_name if p else user.name,
        "headline": p.headline if p else "",
        "bio": p.bio if p else "",
        "isPublished": bool(p and p.is_published),
        "allowIndexing": bool(p and p.allow_indexing),
        "proofIds": items.get("proofIds", []),
        "reviewIds": items.get("reviewIds", []),
        "showGithub": items.get("showGithub", True),
        "showReadiness": items.get("showReadiness", False),
        "publicUrl": f"{get_settings().app_url.rstrip('/')}/p/{p.slug}" if p else None,
    }


def _portfolio_of(db: Session, user_id: int) -> Portfolio | None:
    return db.scalar(select(Portfolio).where(Portfolio.user_id == user_id))


@router.get("/api/portfolio")
def get_portfolio(user: User = Depends(current_user), db: Session = Depends(get_db)):
    proofs = db.scalars(select(ProofAssessment).where(ProofAssessment.user_id == user.id,
                                                      ProofAssessment.status == "completed")
                        .order_by(ProofAssessment.completed_at.desc())).all()
    reviews = db.scalars(select(ProjectReview).where(ProjectReview.user_id == user.id)
                         .order_by(ProjectReview.created_at.desc())).all()
    return {
        "settings": _settings_view(_portfolio_of(db, user.id), user),
        "proofs": [{"id": p.id, "skill": p.skill, "level": p.level, "proficiency": p.proficiency,
                    "completedAt": p.completed_at.isoformat() if p.completed_at else None} for p in proofs],
        "reviews": [{"id": r.id, "repo": r.repo_full_name, "overallScore": r.overall_score,
                     "ownership": r.ownership["status"], "createdAt": r.created_at.isoformat()}
                    for r in reviews],
    }


class PortfolioIn(BaseModel):
    slug: str = Field(min_length=3, max_length=40)
    displayName: str = Field(default="", max_length=120)
    headline: str = Field(default="", max_length=160)
    bio: str = Field(default="", max_length=1500)
    isPublished: bool = False
    allowIndexing: bool = False
    proofIds: list[int] = Field(default_factory=list, max_length=100)
    reviewIds: list[int] = Field(default_factory=list, max_length=50)
    showGithub: bool = True
    showReadiness: bool = False


@router.put("/api/portfolio")
def save_portfolio(body: PortfolioIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    slug = body.slug.strip().lower()
    if not SLUG_RE.match(slug) or slug in RESERVED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Choose a link name of 3-40 lowercase letters, numbers or dashes.")
    taken = db.scalar(select(Portfolio).where(Portfolio.slug == slug, Portfolio.user_id != user.id))
    if taken is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "That link name is taken. Try another one.")
    # Only the user's own, completed items can be shown.
    proof_ids = db.scalars(select(ProofAssessment.id).where(
        ProofAssessment.user_id == user.id, ProofAssessment.status == "completed",
        ProofAssessment.id.in_(body.proofIds or [-1]))).all()
    review_ids = db.scalars(select(ProjectReview.id).where(
        ProjectReview.user_id == user.id, ProjectReview.id.in_(body.reviewIds or [-1]))).all()

    p = _portfolio_of(db, user.id) or Portfolio(user_id=user.id)
    p.slug = slug
    p.display_name = body.displayName.strip()
    p.headline = body.headline.strip()
    p.bio = body.bio.strip()
    p.is_published = body.isPublished
    p.allow_indexing = body.allowIndexing
    p.items = {"proofIds": sorted(proof_ids), "reviewIds": sorted(review_ids),
               "showGithub": body.showGithub, "showReadiness": body.showReadiness}
    p.updated_at = utcnow()
    db.add(p)
    db.commit()
    return _settings_view(p, user)


# ---------------------------------------------------------------- public
def _published(db: Session, slug: str) -> Portfolio:
    p = db.scalar(select(Portfolio).where(Portfolio.slug == slug.lower(), Portfolio.is_published))
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This portfolio does not exist or is not public.")
    return p


def _selected_proofs(db: Session, p: Portfolio) -> list[ProofAssessment]:
    ids = (p.items or {}).get("proofIds") or [-1]
    return db.scalars(select(ProofAssessment).where(
        ProofAssessment.user_id == p.user_id, ProofAssessment.status == "completed",
        ProofAssessment.id.in_(ids)).order_by(ProofAssessment.completed_at.desc())).all()


def public_payload(db: Session, p: Portfolio) -> dict:
    items = p.items or {}
    proofs_by_skill: dict[str, dict] = {}
    for proof in _selected_proofs(db, p):
        key = proof.skill_key
        if key in proofs_by_skill:
            continue  # newest selected proof per skill
        attempts = db.scalar(select(func.count(ProofAssessment.id)).where(
            ProofAssessment.user_id == p.user_id, ProofAssessment.skill_key == key,
            ProofAssessment.status == "completed"))
        proofs_by_skill[key] = {"skill": proof.skill, "level": proof.level, "proficiency": proof.proficiency,
                                "completedAt": proof.completed_at.isoformat() if proof.completed_at else None,
                                "attempts": attempts}

    review_ids = items.get("reviewIds") or [-1]
    reviews = db.scalars(select(ProjectReview).where(ProjectReview.user_id == p.user_id,
                                                     ProjectReview.id.in_(review_ids))
                         .order_by(ProjectReview.overall_score.desc())).all()
    projects = []
    for r in reviews:
        v = review_view(r)
        rev = v["review"]
        projects.append({
            "repo": v["repo"], "repoUrl": v["repoUrl"], "commitUrl": v["commitUrl"],
            "commitSha": v["commitSha"][:7], "ownership": v["ownership"], "overallScore": v["overallScore"],
            "projectType": rev["project_type"], "summary": rev["summary"], "highlights": rev["highlights"],
            "rubric": [{"dimension": i["dimension"], "score": i["score"]} for i in rev["rubric"]],
            "skills": [{"skill": s["skill"], "level": s["level"], "score": s["score"]}
                       for s in rev["skills"]],
            "languages": list((v["meta"].get("languages") or {}).keys())[:5],
            "reviewedAt": v["createdAt"],
        })

    github = None
    if items.get("showGithub", True):
        acct = account_for(db, p.user_id)
        if acct is not None:
            github = {"login": acct.login, "url": f"https://github.com/{acct.login}",
                      "avatarUrl": acct.avatar_url}

    readiness_info = None
    if items.get("showReadiness"):
        target = readiness.active_target(db, p.user_id)
        if target is not None:
            ev = db.scalars(select(Evidence).where(Evidence.user_id == p.user_id,
                                                   Evidence.target_role_id == target.id)).all()
            computed = readiness.compute_readiness(target, list(ev))
            readiness_info = {"role": target.title, "score": computed["score"],
                              "coverage": computed["coverage"]}

    return {
        "slug": p.slug,
        "displayName": p.display_name,
        "headline": p.headline,
        "bio": p.bio,
        "github": github,
        "readiness": readiness_info,
        "proofs": list(proofs_by_skill.values()),
        "projects": projects,
        "updatedAt": p.updated_at.isoformat(),
    }


@router.get("/api/public/portfolio/{slug}")
def public_portfolio(slug: str, response: Response, db: Session = Depends(get_db)):
    p = _published(db, slug)
    if not p.allow_indexing:
        response.headers.update(NOINDEX)
    return public_payload(db, p)


_LEVEL_COLORS = {"Advanced": "#2e7d32", "Intermediate": "#1565c0", "Beginner": "#6a1b9a",
                 "Foundational": "#757575"}


def badge_svg(label: str, message: str, color: str) -> str:
    """A shields.io-style flat badge. Widths are approximated from character counts."""
    label, message = html.escape(label[:40]), html.escape(message[:40])
    lw, mw = 10 + 7 * len(html.unescape(label)), 10 + 7 * len(html.unescape(message))
    w = lw + mw
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="20" role="img" '
            f'aria-label="{label}: {message}"><title>{label}: {message}</title>'
            f'<rect width="{lw}" height="20" fill="#555"/><rect x="{lw}" width="{mw}" height="20" '
            f'fill="{color}"/><g fill="#fff" text-anchor="middle" '
            f'font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">'
            f'<text x="{lw / 2}" y="14">{label}</text><text x="{lw + mw / 2}" y="14">{message}</text>'
            f"</g></svg>")


@router.get("/api/public/portfolio/{slug}/badge.svg")
def badge(slug: str, skill: str = Query(min_length=1, max_length=60), db: Session = Depends(get_db)):
    p = _published(db, slug)
    wanted = re.sub(r"[^a-z0-9+#]+", " ", skill.lower()).strip()
    proof = next((x for x in _selected_proofs(db, p) if x.skill_key == wanted), None)
    if proof is None:
        svg = badge_svg(skill, "not proven", "#9e9e9e")
    else:
        svg = badge_svg(proof.skill, f"{proof.level} ✓", _LEVEL_COLORS.get(proof.level or "", "#555"))
    headers = {"Cache-Control": "public, max-age=3600"}
    if not p.allow_indexing:
        headers.update(NOINDEX)
    return Response(svg, media_type="image/svg+xml", headers=headers)


# ---------------------------------------------------------------- link previews (used by the SPA route)
_SLUG_PATH = re.compile(r"^p/([a-z0-9-]{3,40})/?$")


def share_page(db: Session, path: str, index_html: str) -> tuple[str, dict] | None:
    """For /p/<slug>: inject title, description, OpenGraph and robots tags into index.html."""
    match = _SLUG_PATH.match(path)
    if not match:
        return None
    p = db.scalar(select(Portfolio).where(Portfolio.slug == match.group(1), Portfolio.is_published))
    if p is None:
        # Unknown or unpublished: tell crawlers to drop any copy they indexed while it was public.
        page = index_html.replace("</head>", '<meta name="robots" content="noindex, nofollow"/></head>', 1)
        return page, {"Cache-Control": "no-cache", **NOINDEX}
    name = p.display_name or "SkillSphere member"
    title = html.escape(f"{name}: verified skills | SkillSphere")
    desc = html.escape(p.headline
                       or f"Skills {name} has proven with timed assessments and reviewed projects.")
    url = html.escape(f"{get_settings().app_url.rstrip('/')}/p/{p.slug}")
    tags = (f"<title>{title}</title>"
            f'<meta name="description" content="{desc}"/>'
            f'<meta property="og:title" content="{title}"/>'
            f'<meta property="og:description" content="{desc}"/>'
            f'<meta property="og:url" content="{url}"/>'
            f'<meta property="og:type" content="profile"/>')
    headers = {"Cache-Control": "no-cache"}
    if not p.allow_indexing:
        tags += '<meta name="robots" content="noindex, nofollow"/>'
        headers.update(NOINDEX)
    page = re.sub(r"<title>.*?</title>", "", index_html, count=1, flags=re.S)
    page = re.sub(r'<meta\s+(?:name="description"|property="og:[a-z]+")[^>]*>', "", page)
    return page.replace("</head>", tags + "</head>", 1), headers
