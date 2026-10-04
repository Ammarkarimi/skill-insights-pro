"""'Defend your resume': an adaptive interview that probes the claims on a resume.

Flow: plan_interview() picks 4-6 resume claims tied to the target role's requirements, then for
each candidate answer the server either asks a follow-up (at most MAX_FOLLOW_UPS per topic,
decided by next_turn()) or moves to the next topic's prepared opening question. The final
report verifies each claim and scores each topic.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field

from ..llm import generate
from ..models import TargetRole
from .readiness import match_requirement

log = logging.getLogger(__name__)

MAX_FOLLOW_UPS = 2
MAX_ANSWERS = 18


# ---------------------------------------------------------------- planning
class TopicPlan(BaseModel):
    requirement: str = Field(description="Which listed requirement this topic tests (exact name), "
                                         "or 'General' if none fits")
    claim: str = Field(description="A short VERBATIM quote from the resume that this topic probes")
    opening_question: str = Field(description="Conversational question about that claim, 1-2 sentences")
    strong_answer: str = Field(description="What a strong answer would include (for the interviewer)")


class InterviewPlan(BaseModel):
    topics: list[TopicPlan]


PLAN_SYSTEM = """You are a sharp, fair hiring manager preparing a "defend your resume" interview.
Pick the resume claims that matter most for the target role: quantified achievements, key \
technologies, ownership/leadership statements and anything that sounds impressive but vague. \
Each topic must quote a real claim verbatim and test one requirement. Spread topics across \
different requirements and different parts of the resume. Questions are spoken aloud: no code, \
no lists, one question at a time."""


def plan_interview(resume_text: str, role_title: str, target: TargetRole | None, n_topics: int,
                   user_id: int) -> list[dict]:
    reqs = ", ".join(r["name"] for r in target.requirements) if target else "infer from the role"
    prompt = (f"Target role: {role_title}\nRequirements: {reqs}\nNumber of topics: {n_topics}\n\n"
              f"<resume>\n{resume_text}\n</resume>")
    plan = generate(InterviewPlan, system=PLAN_SYSTEM, prompt=prompt, user_id=user_id)
    topics = []
    for t in plan.topics[:n_topics]:
        topics.append({
            "index": len(topics),
            "requirement": t.requirement.strip(),
            "requirement_key": match_requirement(target, t.requirement),
            "claim": t.claim.strip()[:400],
            "opening_question": t.opening_question.strip(),
            "strong_answer": t.strong_answer.strip(),
        })
    if len(topics) < 2:
        raise HTTPException(502, "Could not find enough resume claims to interview you on. "
                                 "You were not charged; please check your resume and retry.")
    return topics


# ---------------------------------------------------------------- turns
class TurnDecision(BaseModel):
    action: Literal["follow_up", "next_topic"] = Field(
        description="follow_up if the answer is vague, unsupported, partially wrong or invites a "
                    "deeper probe; next_topic if the claim is now well supported or clearly unsupported")
    question: str = Field(description="The follow-up question (one sentence or two), '' for next_topic")


TURN_SYSTEM = """You are the interviewer in a live "defend your resume" interview. Decide whether \
to probe the current claim further. Good follow-ups ask for specifics: how it was measured, the \
candidate's personal contribution vs. the team's, trade-offs, what went wrong, or numbers. Never \
repeat a question. Keep it conversational and one question at a time."""


def _topic_transcript(transcript: list[dict], topic_index: int) -> str:
    lines = []
    for t in transcript:
        if t["topic"] == topic_index:
            who = "Interviewer" if t["role"] == "interviewer" else "Candidate"
            lines.append(f"{who}: {t['text']}")
    return "\n".join(lines)


def decide_next(topic: dict, transcript: list[dict], follow_ups: int, user_id: int) -> str | None:
    """Return a follow-up question, or None to move on. Failures degrade to moving on."""
    if follow_ups >= MAX_FOLLOW_UPS:
        return None
    prompt = (f"Claim being probed: \"{topic['claim']}\" (requirement: {topic['requirement']})\n"
              f"A strong answer would cover: {topic['strong_answer']}\n"
              f"Follow-ups already asked on this topic: {follow_ups} of {MAX_FOLLOW_UPS}\n\n"
              f"<answer>\n{_topic_transcript(transcript, topic['index'])}\n</answer>")
    try:
        decision = generate(TurnDecision, system=TURN_SYSTEM, prompt=prompt, fast=True, user_id=user_id)
    except HTTPException as exc:  # a turn must never break a paid session
        log.warning("deep interview turn fell back to next topic: %s", exc.detail)
        return None
    if decision.action == "follow_up" and decision.question.strip():
        return decision.question.strip()
    return None


# ---------------------------------------------------------------- report
class TopicResult(BaseModel):
    score: int = Field(description="0-10 for how convincingly the claim was defended")
    claim_verdict: Literal["supported", "weak", "unsupported"]
    verdict_reason: str
    strengths: list[str]
    improvements: list[str]
    resume_fix: str = Field(description="How to reword or back up this resume line, or '' if it is fine")
    model_answer: str = Field(description="A strong 80-150 word answer to the opening question")


class DeepReport(BaseModel):
    overall_score: int = Field(description="0-100")
    readiness: Literal["ready", "almost_ready", "needs_practice", "not_ready"]
    summary: str = Field(description="3-4 sentence debrief like a real hiring manager")
    communication: str = Field(description="Clarity, structure and confidence; use delivery stats if given")
    top_strengths: list[str]
    focus_next: list[str] = Field(description="3 concrete things to practise or fix next")
    topics: list[TopicResult] = Field(description="One per topic, same order")


REPORT_SYSTEM = """You are a hiring manager writing feedback after a "defend your resume" \
interview. Answers may be speech transcripts: ignore filler and transcription errors and judge \
substance. A claim is "supported" when the candidate gave specific, credible detail; "weak" when \
vague or partly convincing; "unsupported" when they could not back it up or contradicted it. \
Be specific and honest, never inflate scores, and give practical resume fixes."""


def summarize_delivery(transcript: list[dict]) -> dict | None:
    voiced = [t["metrics"] for t in transcript
              if t["role"] == "candidate" and (t.get("metrics") or {}).get("mode") == "voice"]
    if not voiced:
        return None
    minutes = sum(m.get("durationSec", 0) for m in voiced) / 60 or 1 / 60
    words = sum(m.get("words", 0) for m in voiced)
    fillers = sum(m.get("fillers", 0) for m in voiced)
    return {
        "voiceAnswers": len(voiced),
        "wordsPerMinute": round(words / minutes),
        "fillersPerMinute": round(fillers / minutes, 1),
        "longPauses": sum(m.get("longPauses", 0) for m in voiced),
    }


def final_report(role_title: str, plan: list[dict], transcript: list[dict], user_id: int) -> dict:
    delivery = summarize_delivery(transcript)
    blocks = []
    for topic in plan:
        convo = _topic_transcript(transcript, topic["index"]) or "(not reached)"
        blocks.append(f"Topic {topic['index'] + 1}. Claim: \"{topic['claim']}\" "
                      f"(requirement: {topic['requirement']})\n<answer>\n{convo}\n</answer>")
    prompt = f"Target role: {role_title}\n"
    if delivery:
        prompt += f"Delivery stats (voice answers): {delivery}\n"
    prompt += "\n" + "\n\n".join(blocks)
    report = generate(DeepReport, system=REPORT_SYSTEM, prompt=prompt, user_id=user_id)

    reached = {t["topic"] for t in transcript if t["role"] == "candidate"}
    topics = []
    for topic in plan:
        r = report.topics[topic["index"]] if topic["index"] < len(report.topics) else None
        answered = topic["index"] in reached
        topics.append({
            "index": topic["index"],
            "requirement": topic["requirement"],
            "requirementKey": topic["requirement_key"],
            "claim": topic["claim"],
            "question": topic["opening_question"],
            "answered": answered,
            "score": max(0, min(10, r.score)) if r and answered else 0,
            "claimVerdict": r.claim_verdict if r and answered else "unsupported",
            "verdictReason": r.verdict_reason if r and answered else "Not reached in this interview.",
            "strengths": r.strengths if r and answered else [],
            "improvements": r.improvements if r and answered else [],
            "resumeFix": r.resume_fix if r else "",
            "modelAnswer": r.model_answer if r else "",
        })
    return {
        "overall": {
            "overall_score": max(0, min(100, report.overall_score)),
            "readiness": report.readiness,
            "summary": report.summary,
            "communication": report.communication,
            "top_strengths": report.top_strengths,
            "focus_next": report.focus_next,
        },
        "topics": topics,
        "delivery": delivery,
    }
