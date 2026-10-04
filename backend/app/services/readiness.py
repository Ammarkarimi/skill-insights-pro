"""Target-role readiness: requirement maps and the evidence that measures them."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import quote

from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..llm import generate
from ..models import Evidence, TargetRole

# Score used for baseline evidence derived from the resume at setup time.
BASELINE_SCORES = {"met": 85, "partial": 55, "missing": 15}


# ---------------------------------------------------------------- requirement extraction
class RequirementLLM(BaseModel):
    name: str = Field(description="Short canonical name, e.g. 'React', 'System design', 'CI/CD'")
    kind: Literal["skill", "experience", "practice"] = Field(
        description="skill = testable technology/knowledge; experience = years/domain/scope; "
                    "practice = ways of working such as code review, testing, communication")
    weight: int = Field(description="Importance for this role: 3 critical, 2 important, 1 nice-to-have")
    must_have: bool
    aliases: list[str] = Field(description="Other names/spellings for this requirement (lowercase), "
                                           "e.g. ['reactjs', 'react.js'] for React")
    baseline_status: Literal["met", "partial", "missing", "unknown"] = Field(
        description="From the resume only. 'unknown' when no resume was provided")
    baseline_evidence: str = Field(description="Where the resume shows it (or why not); '' if unknown")


class RequirementMap(BaseModel):
    summary: str = Field(description="One-sentence description of what this role needs")
    requirements: list[RequirementLLM] = Field(description="8-14 requirements, most important first")


REQUIREMENTS_SYSTEM = """You are a senior technical recruiter building a hiring scorecard.
From the role title (and job description when given), list the requirements a hiring manager \
would actually screen for. Prefer specific, testable skills (e.g. "PostgreSQL", "REST API \
design") over vague ones ("databases"). Merge duplicates. Include at most 3 practices and at \
most 2 experience items. If a resume is given, judge each requirement strictly from evidence \
in the resume; otherwise use baseline_status "unknown"."""


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "req"


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9+#]+", " ", text.lower()).strip()


def extract_requirements(title: str, job_description: str, resume_text: str,
                         user_id: int) -> tuple[str, list[dict], dict[str, dict]]:
    """Returns (summary, requirements, baseline-by-key)."""
    prompt = f"Role title: {title}\n"
    if job_description:
        prompt += f"<job_description>\n{job_description}\n</job_description>\n"
    if resume_text:
        prompt += f"<resume>\n{resume_text}\n</resume>\n"
    result = generate(RequirementMap, system=REQUIREMENTS_SYSTEM, prompt=prompt, user_id=user_id)

    requirements, baseline, seen = [], {}, set()
    for r in result.requirements[:14]:
        key = slugify(r.name)
        if key in seen:
            continue
        seen.add(key)
        aliases = sorted({_norm(a) for a in r.aliases if _norm(a)} - {_norm(r.name)})
        requirements.append({
            "key": key, "name": r.name.strip(), "kind": r.kind,
            "weight": max(1, min(3, r.weight)), "must_have": r.must_have, "aliases": aliases,
        })
        if resume_text and r.baseline_status != "unknown":
            baseline[key] = {"status": r.baseline_status, "evidence": r.baseline_evidence}
    return result.summary, requirements, baseline


def match_requirement(target: TargetRole | None, skill: str) -> str | None:
    """Map a free-text skill name (e.g. from an assessment) onto a requirement key."""
    if target is None or not skill:
        return None
    wanted = _norm(skill)
    for req in target.requirements:
        if wanted == _norm(req["name"]) or wanted in req.get("aliases", []):
            return req["key"]
    return None


# ---------------------------------------------------------------- persistence helpers
def active_target(db: Session, user_id: int) -> TargetRole | None:
    return db.scalar(select(TargetRole).where(TargetRole.user_id == user_id, TargetRole.is_active)
                     .order_by(TargetRole.created_at.desc()).limit(1))


def activate(db: Session, target: TargetRole) -> None:
    db.execute(update(TargetRole).where(TargetRole.user_id == target.user_id)
               .values(is_active=False))
    target.is_active = True
    db.commit()


def record_evidence(db: Session, user_id: int, source: str, skill: str, score: int,
                    payload: dict | None = None, target: TargetRole | None = None,
                    requirement_key: str | None = None, commit: bool = True) -> Evidence:
    """Store one observation, mapped to the active target's requirement when possible."""
    if target is None:
        target = active_target(db, user_id)
    key = requirement_key or match_requirement(target, skill)
    evidence = Evidence(
        user_id=user_id,
        target_role_id=target.id if target else None,
        requirement_key=key,
        skill=skill[:120],
        source=source,
        score=max(0, min(100, int(score))),
        payload=payload or {},
    )
    db.add(evidence)
    if commit:
        db.commit()
    return evidence


def target_to_dict(target: TargetRole) -> dict:
    return {
        "id": target.id,
        "title": target.title,
        "summary": target.summary,
        "jobDescription": target.job_description,
        "requirements": target.requirements,
        "isActive": target.is_active,
        "createdAt": target.created_at.isoformat(),
    }


# ---------------------------------------------------------------- scoring (deterministic, no LLM)
SOURCE_WEIGHTS = {"assessment": 1.0, "deep_interview": 1.0, "interview": 0.7, "resume": 0.5,
                  "baseline": 0.4}
HALF_LIFE_DAYS = 90.0
SOURCE_LABELS = {"assessment": "Skill assessment", "deep_interview": "Deep interview",
                 "interview": "Practice interview", "resume": "Resume analysis",
                 "baseline": "Resume (setup)"}


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _requirement_scores(target: TargetRole, evidence: list[Evidence], now: datetime) -> list[dict]:
    by_key: dict[str, list[Evidence]] = {}
    for e in evidence:
        if e.requirement_key and _as_utc(e.created_at) <= now:
            by_key.setdefault(e.requirement_key, []).append(e)
    rows = []
    for req in target.requirements:
        items = by_key.get(req["key"], [])
        total_w = weighted = 0.0
        latest: dict[str, int] = {}
        for e in sorted(items, key=lambda x: _as_utc(x.created_at)):
            age = max(0.0, (now - _as_utc(e.created_at)).total_seconds() / 86400)
            w = SOURCE_WEIGHTS.get(e.source, 0.5) * 0.5 ** (age / HALF_LIFE_DAYS)
            total_w += w
            weighted += w * e.score
            latest[e.source] = e.score
        rows.append({
            **{k: req[k] for k in ("key", "name", "kind", "weight", "must_have")},
            "score": round(weighted / total_w) if total_w else None,
            "sources": latest,
            "evidenceCount": len(items),
            "lastUpdated": _as_utc(items[-1].created_at).isoformat() if items else None,
        })
    return rows


def _overall(rows: list[dict]) -> tuple[int, int]:
    """(readiness, coverage). Unmeasured requirements count as 0: readiness must be proven."""
    total_weight = sum(r["weight"] for r in rows) or 1
    readiness = round(sum(r["weight"] * (r["score"] or 0) for r in rows) / total_weight)
    coverage = round(100 * sum(1 for r in rows if r["score"] is not None) / (len(rows) or 1))
    return readiness, coverage


def compute_readiness(target: TargetRole, evidence: list[Evidence],
                      now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    rows = _requirement_scores(target, evidence, now)
    readiness, coverage = _overall(rows)

    # Trend: readiness as of the end of each day that had new evidence (plus today).
    days = sorted({_as_utc(e.created_at).date() for e in evidence
                   if e.requirement_key and (now - _as_utc(e.created_at)).days <= 90})
    trend = []
    for day in days:
        end = min(now, datetime.combine(day, datetime.max.time(), tzinfo=timezone.utc))
        score, _ = _overall(_requirement_scores(target, evidence, end))
        trend.append({"date": day.isoformat(), "score": score})
    if not trend or trend[-1]["date"] != now.date().isoformat():
        trend.append({"date": now.date().isoformat(), "score": readiness})

    order = sorted(rows, key=lambda r: (not r["must_have"], -r["weight"],
                                        r["score"] if r["score"] is not None else -1))
    return {"score": readiness, "coverage": coverage, "requirements": order, "trend": trend}


def next_actions(target: TargetRole, computed: dict, evidence: list[Evidence],
                 now: datetime | None = None, limit: int = 4) -> list[dict]:
    """Rule-based suggestions for the step that will move readiness the most."""
    now = now or datetime.now(timezone.utc)
    rows = computed["requirements"]
    actions: list[dict] = []

    def recent(source: str, days: int) -> bool:
        return any(e.source == source and (now - _as_utc(e.created_at)).days < days for e in evidence)

    unmeasured = [r for r in rows if r["score"] is None and r["kind"] == "skill"]
    unmeasured.sort(key=lambda r: (not r["must_have"], -r["weight"]))
    if unmeasured:
        names = [r["name"] for r in unmeasured[:3]]
        actions.append({
            "type": "assessment",
            "title": f"Measure {', '.join(names)}",
            "description": "These requirements have no evidence yet. A 10-question assessment "
                           "turns them into a score.",
            "href": "/skill-assessment?skills=" + quote(",".join(names)),
        })

    if not recent("resume", 30):
        actions.append({
            "type": "resume",
            "title": f"Tailor your resume for {target.title}",
            "description": "Analyse your resume against this role's requirements and missing keywords.",
            "href": "/resume-tips?useTarget=1",
        })

    if not recent("deep_interview", 14):
        actions.append({
            "type": "deep_interview",
            "title": "Defend your resume in a mock interview",
            "description": "An interviewer probes the claims on your resume for this role, with "
                           "follow-up questions.",
            "href": "/practice-interview?mode=deep",
        })

    weak = [r for r in rows if r["score"] is not None and r["score"] < 60]
    weak.sort(key=lambda r: (not r["must_have"], r["score"]))
    if weak:
        r = weak[0]
        actions.append({
            "type": "improve",
            "title": f"Close your gap in {r['name']} ({r['score']}/100)",
            "description": "Retake an assessment to get a learning path built from your mistakes.",
            "href": "/skill-assessment?skills=" + quote(r["name"]),
        })
    return actions[:limit]


# ---------------------------------------------------------------- evidence from existing features
# A perfect beginner test should not count as fully proven for a professional role.
DIFFICULTY_FACTOR = {"beginner": 0.7, "intermediate": 0.9, "advanced": 1.0}
RESUME_PRESENT, RESUME_MISSING = 75, 20


def record_assessment(db: Session, user_id: int, session_id: int, difficulty: str,
                      per_skill: dict[str, dict]) -> None:
    factor = DIFFICULTY_FACTOR.get(difficulty, 0.8)
    target = active_target(db, user_id)
    for skill, stats in per_skill.items():
        record_evidence(db, user_id, "assessment", skill, round(stats["score"] * factor),
                        payload={"sessionId": session_id, "difficulty": difficulty, **stats},
                        target=target, commit=False)
    db.commit()


def _mentions(text: str, terms: list[str]) -> bool:
    padded = f" {_norm(text)} "
    return any(t and f" {t} " in padded for t in terms)


def record_resume(db: Session, user_id: int, target: TargetRole, resume_text: str,
                  overall_score: int) -> None:
    """Skill requirements mentioned in the resume get partial credit; missing ones are flagged."""
    for req in target.requirements:
        if req["kind"] != "skill":
            continue
        present = _mentions(resume_text, [_norm(req["name"]), *req.get("aliases", [])])
        record_evidence(db, user_id, "resume", req["name"], RESUME_PRESENT if present else RESUME_MISSING,
                        payload={"present": present, "overallScore": overall_score},
                        target=target, requirement_key=req["key"], commit=False)
    db.commit()


def record_interview(db: Session, user_id: int, topic: str, overall_score: int,
                     interview_id: int) -> None:
    target = active_target(db, user_id)
    key = match_requirement(target, topic)
    if key is None and target is not None:  # fall back to a communication-type requirement
        key = next((r["key"] for r in target.requirements
                    if r["kind"] == "practice" and "communicat" in r["name"].lower()), None)
    record_evidence(db, user_id, "interview", topic, overall_score,
                    payload={"interviewId": interview_id}, target=target, requirement_key=key)
