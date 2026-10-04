from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..models import User
from ..security import current_user
from ..services import career as svc

router = APIRouter(prefix="/api/career", tags=["career"])


class SkillIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    proficiency: int = Field(ge=0, le=100)


class RecommendIn(BaseModel):
    skills: list[SkillIn] = Field(min_length=1, max_length=25)
    goal: str = Field(default="", max_length=300)
    experience: str = Field(default="", max_length=60)
    location: str = Field(default="", max_length=100)


@router.post("/recommendations")
def recommendations(body: RecommendIn, response: Response, user: User = Depends(current_user),
                    db: Session = Depends(get_db)):
    with charge(db, user, "career_recommendations", response):
        return svc.recommend([s.model_dump() for s in body.skills], body.goal.strip(),
                             body.experience.strip(), body.location.strip(), user.id)
