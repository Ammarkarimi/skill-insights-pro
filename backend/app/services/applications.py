"""Job application tracker: stage checklists, pipeline stats and the AI prep kit."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from ..llm import generate
from ..models import Application

Status = Literal["saved", "applied", "assessment", "interview", "offer", "rejected", "withdrawn"]
PIPELINE = ["saved", "applied", "assessment", "interview", "offer"]
CLOSED = {"rejected", "withdrawn"}

# Deterministic prep steps per stage. `href` deep-links into the tool with the job prefilled;
# `action` items are handled on the Applications page itself.
LETTERS = "/letters?application={id}&kind="


def _item(key: str, label: str, href: str | None = None, action: str | None = None) -> dict:
    return {"key": key, "label": label, "href": href, "action": action}


CHECKLIST: dict[str, list[dict]] = {
    "saved": [
        _item("make_target", "Score your readiness for this job", action="make_target"),
        _item("tailor", "Tailor your resume", "/resume-tailor?application={id}"),
        _item("cover_letter", "Write a cover letter", LETTERS + "cover_letter"),
    ],
    "applied": [
        _item("follow_up", "Send a recruiter follow-up", LETTERS + "recruiter_email"),
        _item("referral", "Ask a contact for a referral", LETTERS + "referral_request"),
    ],
    "assessment": [
        _item("aptitude", "Practise an aptitude test", "/practice-tests?tab=aptitude"),
        _item("coding", "Take a timed coding assessment", "/practice-tests?tab=coding&mode=oa"),
    ],
    "interview": [
        _item("prep_kit", "Generate the interview prep kit", action="prep_kit"),
        _item("defend", "Defend your resume", "/practice-interview?mode=deep"),
        _item("stories", "Drill your STAR stories", "/stories?tab=drill"),
        _item("mock", "Run a mock interview", "/practice-interview"),
        _item("thank_you", "Send a thank-you note", LETTERS + "thank_you"),
    ],
    "offer": [
        _item("negotiate", "Practise the salary negotiation", "/negotiation?application={id}"),
    ],
}


def furthest_stage(app: Application) -> str:
    """The furthest pipeline stage reached, even if the application is now closed."""
    reached = [h["status"] for h in app.status_history or []] + [app.status]
    return max((s for s in reached if s in PIPELINE), key=PIPELINE.index, default="saved")


def checklist(app: Application) -> list[dict]:
    """All prep steps up to the furthest stage reached, with completion state."""
    upto = PIPELINE.index(furthest_stage(app))
    done = app.checklist or {}
    items = []
    for stage in PIPELINE[: upto + 1]:
        for item in CHECKLIST[stage]:
            href = item["href"]
            items.append({**item, "stage": stage, "href": href.format(id=app.id) if href else None,
                          "done": bool(done.get(item["key"]))})
    return items


VALID_CHECKLIST_KEYS = {item["key"] for items in CHECKLIST.values() for item in items}


def stats(apps: list[Application], today: date | None = None) -> dict:
    today = today or date.today()
    counts = {s: 0 for s in PIPELINE + sorted(CLOSED)}
    for a in apps:
        counts[a.status] = counts.get(a.status, 0) + 1
    reached = [PIPELINE.index(furthest_stage(a)) for a in apps]
    applied = sum(1 for r in reached if r >= 1)
    responded = sum(1 for r in reached if r >= 2)
    upcoming = sorted(
        ({"id": a.id, "company": a.company, "title": a.title, "date": a.next_date, "label": a.next_label}
         for a in apps if a.next_date and a.next_date >= today.isoformat() and a.status not in CLOSED),
        key=lambda u: u["date"])
    return {
        "counts": counts,
        "applied": applied,
        "responseRate": round(100 * responded / applied) if applied else None,
        "interviews": sum(1 for r in reached if r >= 3),
        "offers": sum(1 for r in reached if r >= 4),
        "upcoming": upcoming[:5],
    }


# ---------------------------------------------------------------- AI prep kit
class FocusSkill(BaseModel):
    skill: str
    priority: Literal["high", "medium", "low"]
    why: str = Field(description="One line quoting or paraphrasing where the job description asks for it")


class LikelyQuestion(BaseModel):
    question: str
    type: Literal["technical", "behavioral", "situational", "role_fit"]
    tip: str = Field(description="One line on what a strong answer covers")


class PrepKitLLM(BaseModel):
    role_summary: str = Field(description="2 sentences: what the role does and what success looks like")
    focus_skills: list[FocusSkill] = Field(description="5-8 skills to brush up, most important first")
    likely_questions: list[LikelyQuestion] = Field(description="8 questions this interview will likely ask")
    questions_to_ask: list[str] = Field(description="5 thoughtful questions to ask the interviewer")
    research_checklist: list[str] = Field(description="5 things to look up about the company beforehand")


PREP_SYSTEM = """You are an experienced hiring manager coaching a candidate for one specific job.
Rules:
- Base everything on the job description. Do not state facts about the company (products, news, \
culture, size, funding) that are not in the job description; instead, put them in the research \
checklist as things to look up.
- Rank focus skills by how strongly the job description stresses them.
- Questions must be specific to this role's responsibilities, not generic.
- If the candidate's known gaps are listed, include questions that probe them."""


def prep_kit(app: Application, gaps: list[str], user_id: int) -> dict:
    gap_text = "\n".join(f"- {g}" for g in gaps) or "(unknown)"
    prompt = (f"Role: {app.title} at {app.company}\n"
              f"Location: {app.location or 'n/a'}\n\n"
              f"<job_description>\n{app.job_description}\n</job_description>\n\n"
              f"Candidate's weakest requirements for their target role:\n{gap_text}")
    kit = generate(PrepKitLLM, system=PREP_SYSTEM, prompt=prompt, user_id=user_id)
    return {
        "roleSummary": kit.role_summary,
        "focusSkills": [s.model_dump() for s in kit.focus_skills[:8]],
        "likelyQuestions": [q.model_dump() for q in kit.likely_questions[:10]],
        "questionsToAsk": kit.questions_to_ask[:6],
        "researchChecklist": kit.research_checklist[:6],
    }
