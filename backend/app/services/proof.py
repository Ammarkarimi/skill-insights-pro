"""Adaptive, timed, server-graded skill proofs.

One LLM call builds a pool of questions in three difficulty tiers. The test then walks a
staircase: start at intermediate, step up after a correct answer and down after a wrong one.
Each question is timed on the server, the answer key never leaves the server before the end,
and the result is a level plus an explainable proficiency score.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, status
from pydantic import Field

from ..llm import generate
from .assessment import MCQ, MCQ_SYSTEM, MCQSet, clean_mcq

QUESTIONS_PER_TEST = 8
PER_TIER_IN_POOL = 5
MIN_PER_TIER = 3
SECONDS_PER_QUESTION = 90
GRACE_SECONDS = 15
COOLDOWN_HOURS = 24
START_TIER = 2
TIER_WEIGHT = {1: 0.6, 2: 0.85, 3: 1.0}
TIER_NAMES = {1: "beginner", 2: "intermediate", 3: "advanced"}
_TIER_BY_NAME = {v: k for k, v in TIER_NAMES.items()}


class TieredMCQ(MCQ):
    level: Literal["beginner", "intermediate", "advanced"] = Field(
        description="beginner = core concepts; intermediate = trade-offs and real-world use; "
                    "advanced = internals, edge cases, performance, architecture")


class ProofPool(MCQSet):
    questions: list[TieredMCQ]


POOL_SYSTEM = MCQ_SYSTEM + """
This is a certification-style test of a single skill. Write exactly the requested number of \
questions at each level, each testing a different sub-topic. Difficulty must genuinely increase \
between levels: an advanced question should be hard for someone with only intermediate experience."""


def generate_pool(skill: str, user_id: int) -> list[dict]:
    prompt = (f"Skill: {skill}\nWrite {PER_TIER_IN_POOL} beginner, {PER_TIER_IN_POOL} intermediate "
              f"and {PER_TIER_IN_POOL} advanced questions ({3 * PER_TIER_IN_POOL} total). "
              f"Set `skill` to \"{skill}\" for every question.")
    result = generate(ProofPool, system=POOL_SYSTEM, prompt=prompt, user_id=user_id)

    pool: list[dict] = []
    counts = {1: 0, 2: 0, 3: 0}
    for q in result.questions:
        tier = _TIER_BY_NAME[q.level]
        item = clean_mcq(q)
        if item is None or counts[tier] >= PER_TIER_IN_POOL:
            continue
        counts[tier] += 1
        pool.append({"id": len(pool) + 1, "tier": tier, **item})
    if min(counts.values()) < MIN_PER_TIER:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            "Could not build a balanced test. You were not charged; please retry.")
    return pool


# ---------------------------------------------------------------- staircase
def pick_question(pool: list[dict], used: set[int], tier: int) -> dict | None:
    """Next unused question at `tier`, falling back to the nearest tiers."""
    for t in sorted((1, 2, 3), key=lambda x: (abs(x - tier), -x)):
        for q in pool:
            if q["tier"] == t and q["id"] not in used:
                return q
    return None


def next_tier(tier: int, correct: bool) -> int:
    return min(3, tier + 1) if correct else max(1, tier - 1)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def seconds_left(served_at: str, now: datetime | None = None) -> int:
    elapsed = ((now or now_utc()) - datetime.fromisoformat(served_at)).total_seconds()
    return max(0, round(SECONDS_PER_QUESTION - elapsed))


def is_late(served_at: str, now: datetime | None = None) -> bool:
    elapsed = ((now or now_utc()) - datetime.fromisoformat(served_at)).total_seconds()
    return elapsed > SECONDS_PER_QUESTION + GRACE_SECONDS


def public_question(q: dict) -> dict:
    """What the candidate sees during the test: no answer, explanation or tier."""
    return {k: q[k] for k in ("id", "question", "code", "options")}


# ---------------------------------------------------------------- scoring
def score(served: list[dict]) -> dict:
    answered = [s for s in served if "correct" in s]
    proficiency = round(100 * sum(TIER_WEIGHT[s["tier"]] for s in answered if s["correct"])
                        / max(1, len(answered)))
    per_tier = {TIER_NAMES[t]: {"answered": sum(1 for s in answered if s["tier"] == t),
                                "correct": sum(1 for s in answered if s["tier"] == t and s["correct"])}
                for t in (1, 2, 3)}
    correct_at = lambda t: sum(1 for s in answered if s["correct"] and s["tier"] >= t)  # noqa: E731
    if per_tier["advanced"]["correct"] >= 2:
        level = "Advanced"
    elif correct_at(2) >= 2:
        level = "Intermediate"
    elif correct_at(1) >= 2:
        level = "Beginner"
    else:
        level = "Foundational"
    return {"proficiency": proficiency, "level": level, "perTier": per_tier,
            "correct": sum(1 for s in answered if s["correct"]), "total": len(answered)}
