"""Target-role readiness: requirement maps and the evidence that measures them."""

from __future__ import annotations

import re
from typing import Literal

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
