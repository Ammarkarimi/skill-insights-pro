"""Career-path recommendations from a self-rated skills profile."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ..links import verify_links
from ..llm import generate


class CareerPath(BaseModel):
    title: str
    description: str
    matchScore: int = Field(description="0-100 fit for this person today")
    whyGoodFit: str
    skills: list[str] = Field(description="Key skills required for the role")
    skillGaps: list[str] = Field(description="Required skills this person lacks or is weak in")
    timeline: str = Field(description="Realistic time to become job-ready, e.g. '3-6 months'")
    avgSalary: str = Field(description="Typical salary range for the given location, with currency")
    growthRate: str = Field(description="Job outlook, e.g. 'High demand, growing'")


class LearningResource(BaseModel):
    title: str
    type: Literal["Course", "Book", "Tutorial", "Documentation", "Certification", "Practice"]
    provider: str
    difficulty: Literal["Beginner", "Intermediate", "Advanced"]
    url: str
    rating: float = Field(description="Approximate public rating out of 5, e.g. 4.7")
    reason: str = Field(description="Why this resource fits this person's gaps")


class SkillToLearn(BaseModel):
    name: str
    priority: Literal["High", "Medium", "Low"]
    category: str = Field(description="e.g. Frontend, Backend, Data, Cloud, DevOps, Soft skill")
    reason: str


class CareerRecommendations(BaseModel):
    summary: str = Field(description="3-4 sentence career-coach summary of this profile")
    careerPaths: list[CareerPath] = Field(description="3-4 paths, best fit first")
    learningResources: list[LearningResource] = Field(description="5-8 resources")
    skillsToLearn: list[SkillToLearn] = Field(description="5-8 skills, highest priority first")
    nextSteps: list[str] = Field(description="3-5 concrete actions for the next 30 days")


CAREER_SYSTEM = """You are a career coach for technology professionals with deep knowledge of \
hiring markets. Give honest, realistic and personalised advice.
- Self-rated proficiency (0-100) is approximate; treat <40 as beginner, 40-70 as working \
knowledge, >70 as strong.
- Salary ranges must be realistic for the stated location and experience level and include the \
currency. If no location is given, use the United States and say so.
- Recommend real resources from reputable providers with stable URLs (official docs, Coursera, \
edX, freeCodeCamp, Udemy, O'Reilly, vendor certification pages). Never invent URLs you are unsure \
of; link to the provider's landing page for the topic instead.
- Align everything with the person's stated goal when one is given."""


def recommend(skills: list[dict], goal: str, experience: str, location: str,
              user_id: int) -> dict:
    profile = "\n".join(f"- {s['name']}: {s['proficiency']}/100" for s in skills)
    prompt = (f"Skills (self-rated):\n{profile}\n"
              f"Experience level: {experience or 'not specified'}\n"
              f"Career goal: {goal or 'not specified'}\n"
              f"Location: {location or 'not specified'}")
    result = generate(CareerRecommendations, system=CAREER_SYSTEM, prompt=prompt, user_id=user_id)
    data = result.model_dump()
    for path in data["careerPaths"]:
        path["matchScore"] = max(0, min(100, path["matchScore"]))
    verify_links(data["learningResources"], url_key="url")
    return data
