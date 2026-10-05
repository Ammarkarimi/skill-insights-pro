from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..credits import charge
from ..db import get_db
from ..documents import resume_text_from_upload
from ..models import Story, StoryDrill, User, utcnow
from ..ratelimit import limiter
from ..security import current_user
from ..services import learning, readiness
from ..services import stories as svc

router = APIRouter(prefix="/api/stories", tags=["stories"])

MAX_STORIES = 60
PART_MAX = 2000


def view(s: Story) -> dict:
    return {
        "id": s.id, "title": s.title, "situation": s.situation, "task": s.task, "action": s.action,
        "result": s.result, "themes": s.themes or [], "origin": s.origin, "coaching": s.coaching or {},
        "critique": s.critique, "score": s.score,
        "spokenSeconds": svc.spoken_seconds(s.situation, s.task, s.action, s.result),
        "placeholders": len(svc.PLACEHOLDER.findall(" ".join((s.situation, s.task, s.action, s.result)))),
        "updatedAt": s.updated_at.isoformat(),
    }


def _brief(s: Story) -> dict:
    return {"id": s.id, "title": s.title, "themes": s.themes or [], "score": s.score}


def _own(db: Session, user: User, story_id: int) -> Story:
    s = db.get(Story, story_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Story not found.")
    return s


def _all(db: Session, user: User) -> list[Story]:
    return list(db.scalars(select(Story).where(Story.user_id == user.id).order_by(Story.updated_at.desc())))


def _target_title(db: Session, user: User) -> str:
    target = readiness.active_target(db, user.id)
    return target.title if target else ""


@router.get("")
def list_stories(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = _all(db, user)
    return {"stories": [view(s) for s in rows], "coverage": svc.coverage([_brief(s) for s in rows]),
            "themes": svc.THEMES}


class StoryIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    situation: str = Field(default="", max_length=PART_MAX)
    task: str = Field(default="", max_length=PART_MAX)
    action: str = Field(default="", max_length=PART_MAX)
    result: str = Field(default="", max_length=PART_MAX)
    themes: list[svc.ThemeKey] = Field(default_factory=list, max_length=3)


class StoryPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    situation: str | None = Field(default=None, max_length=PART_MAX)
    task: str | None = Field(default=None, max_length=PART_MAX)
    action: str | None = Field(default=None, max_length=PART_MAX)
    result: str | None = Field(default=None, max_length=PART_MAX)
    themes: list[svc.ThemeKey] | None = Field(default=None, max_length=3)


def _room(db: Session, user: User, adding: int) -> None:
    if len(_all(db, user)) + adding > MAX_STORIES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"You can keep up to {MAX_STORIES} stories. Delete some to add more.")


@router.post("", status_code=201)
def create(body: StoryIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _room(db, user, 1)
    data = body.model_dump()
    data["themes"] = list(dict.fromkeys(data["themes"]))
    s = Story(user_id=user.id, origin="manual", coaching={}, **{k: v.strip() if isinstance(v, str) else v
                                                                  for k, v in data.items()})
    db.add(s)
    db.commit()
    return view(s)


@router.patch("/{story_id}")
def update(story_id: int, body: StoryPatch, user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    s = _own(db, user, story_id)
    changed = False
    for field in ("title", "situation", "task", "action", "result"):
        value = getattr(body, field)
        if value is not None and value.strip() != getattr(s, field):
            setattr(s, field, value.strip())
            changed = field != "title" or changed
    if body.themes is not None:
        s.themes = list(dict.fromkeys(body.themes))
    if changed and s.critique is not None:
        s.critique = {**s.critique, "stale": True}  # the critique was for the previous wording
    s.updated_at = utcnow()
    db.commit()
    return view(s)


@router.delete("/{story_id}", status_code=204)
def delete(story_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, user, story_id))
    db.commit()
    return Response(status_code=204)


@router.post("/draft", status_code=201)
def draft(response: Response, resume: UploadFile = File(...), user: User = Depends(current_user),
          db: Session = Depends(get_db)):
    resume_text = resume_text_from_upload(resume)  # validated before charging
    _room(db, user, 5)
    limiter.hit(f"ai:{user.id}", get_settings().ai_requests_per_minute)
    room = MAX_STORIES - len(_all(db, user))
    with charge(db, user, "story_draft", response):
        drafts = svc.draft_from_resume(resume_text, _target_title(db, user), user.id, limit=min(8, room))
    if not drafts:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No stories could be drafted. Please try again.")
    rows = [Story(user_id=user.id, origin="draft", **d) for d in drafts]
    db.add_all(rows)
    db.commit()
    return {"stories": [view(s) for s in rows]}


@router.post("/{story_id}/critique")
def critique(story_id: int, response: Response, user: User = Depends(current_user),
             db: Session = Depends(get_db)):
    s = _own(db, user, story_id)
    if sum(len(p.split()) for p in (s.situation, s.task, s.action, s.result)) < 25:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Write a little more first: each part needs at least a sentence.")
    limiter.hit(f"ai:{user.id}", get_settings().ai_requests_per_minute)
    story = {k: getattr(s, k) for k in ("title", "situation", "task", "action", "result")}
    with charge(db, user, "story_critique", response):
        result = svc.critique(story, _target_title(db, user), user.id)
    s.critique = result
    s.score = result["overallScore"]
    if not s.themes:
        s.themes = result["bestThemes"]
    db.commit()
    return view(s)


# ---------------------------------------------------------------- drills
@router.get("/drill/questions")
def drill_questions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Five questions aimed at the user's weakest themes, each with a suggested story. Free."""
    return {"questions": svc.pick_drill([_brief(s) for s in _all(db, user)])}


class DrillAnswerIn(BaseModel):
    question_id: int
    story_id: int | None = None
    answer: str = Field(default="", max_length=4000)


class DrillIn(BaseModel):
    answers: list[DrillAnswerIn] = Field(min_length=1, max_length=svc.DRILL_SIZE)


@router.post("/drill", status_code=201)
def drill(body: DrillIn, response: Response, user: User = Depends(current_user),
          db: Session = Depends(get_db)):
    if not any(a.answer.strip() for a in body.answers):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Answer at least one question first.")
    titles = {s.id: s.title for s in _all(db, user)}
    items = []
    for a in body.answers:
        q = svc.QUESTIONS_BY_ID.get(a.question_id)
        if q is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown question.")
        if a.story_id is not None and a.story_id not in titles:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Story not found.")
        items.append({"questionId": q["id"], "question": q["text"], "themes": q["themes"],
                      "storyId": a.story_id, "storyTitle": titles.get(a.story_id),
                      "answer": a.answer.strip()})
    limiter.hit(f"ai:{user.id}", get_settings().ai_requests_per_minute)
    with charge(db, user, "story_drill", response):
        result = svc.evaluate_drill(items, user.id)
    row = StoryDrill(user_id=user.id, answers=result["answers"], overall=result["overall"],
                     score=result["overall"]["score"])
    db.add(row)
    learning.log_practice(db, user.id, "drill")
    db.commit()
    _record_evidence(db, user, result)
    return {"id": row.id, **result, "createdAt": row.created_at.isoformat()}


def _record_evidence(db: Session, user: User, result: dict) -> None:
    target = readiness.active_target(db, user.id)
    if target is None:
        return
    answered = [a for a in result["answers"] if a["answer"]]
    scores: dict[str, list[int]] = {}
    comm = next((n for n in svc.COMMUNICATION if readiness.match_requirement(target, n)), None)
    if comm:
        scores[comm] = [result["overall"]["score"]]
    for a in answered:
        for theme in a["themes"]:
            name = next((n for n in svc.THEME_REQUIREMENTS.get(theme, [])
                         if readiness.match_requirement(target, n)), None)
            if name:
                scores.setdefault(name, []).append(a["score"] * 10)
    for name, values in scores.items():
        readiness.record_evidence(db, user.id, "story_drill", name, round(sum(values) / len(values)),
                                  target=target, payload={"themes": True}, commit=False)
    db.commit()


@router.get("/drills")
def drills(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(StoryDrill).where(StoryDrill.user_id == user.id)
                      .order_by(StoryDrill.created_at.desc()).limit(20)).all()
    return {"drills": [{"id": r.id, "score": r.score, "count": len(r.answers),
                        "createdAt": r.created_at.isoformat()} for r in rows]}


@router.get("/drills/{drill_id}")
def drill_detail(drill_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(StoryDrill, drill_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Drill not found.")
    return {"id": row.id, "answers": row.answers, "overall": row.overall,
            "createdAt": row.created_at.isoformat()}
