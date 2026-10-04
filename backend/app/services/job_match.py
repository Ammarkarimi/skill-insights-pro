"""Rank resumes against a job description (for candidates comparing versions, or recruiters)."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field

from ..links import verify_links
from ..llm import generate

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")


class MatchResource(BaseModel):
    title: str
    type: Literal["course", "documentation", "tutorial", "project", "certification", "book"]
    provider: str
    link: str
    description: str


class MatchLearningPath(BaseModel):
    title: str
    description: str
    resources: list[MatchResource] = Field(description="2-4 resources closing the biggest gaps")


class RequirementCheck(BaseModel):
    requirement: str = Field(description="A key requirement from the job description")
    status: Literal["met", "partial", "missing"]
    evidence: str = Field(description="Where in the resume it is (or isn't) shown")


class JobMatchLLM(BaseModel):
    candidate_name: str = Field(description="Candidate's name from the resume, or empty string")
    match_percentage: int = Field(description="0-100, using the rubric")
    verdict: Literal["strong_fit", "good_fit", "potential_fit", "weak_fit"]
    summary: str = Field(description="2-3 sentence hiring-manager style assessment")
    requirements: list[RequirementCheck] = Field(description="5-10 most important requirements")
    strengths: list[str]
    weaknesses: list[str] = Field(description="Missing or weak areas relative to the job")
    missing_keywords: list[str] = Field(description="Important JD keywords absent from the resume")
    interview_questions: list[str] = Field(description="3 questions to probe the gaps")
    learning_path: MatchLearningPath


MATCH_SYSTEM = """You are an expert technical recruiter evaluating how well a resume matches a \
job description. Judge evidence, not keyword stuffing.

Rubric for match_percentage:
- 85-100 strong_fit: meets nearly all must-haves with demonstrated experience
- 70-84 good_fit: meets most must-haves; gaps are learnable quickly
- 50-69 potential_fit: meets some must-haves; notable gaps
- 0-49 weak_fit: missing several must-haves or wrong seniority
Distinguish must-have from nice-to-have requirements. Consider seniority and years of experience.
Recommend real, reputable learning resources with stable URLs (official docs, Coursera, edX, \
freeCodeCamp, vendor certifications)."""


def match_resume(filename: str, resume_text: str, job_description: str, user_id: int) -> dict:
    prompt = (f"<job_description>\n{job_description}\n</job_description>\n\n"
              f"<resume>\n{resume_text}\n</resume>")
    llm = generate(JobMatchLLM, system=MATCH_SYSTEM, prompt=prompt, user_id=user_id)
    email_match = _EMAIL.search(resume_text)
    pct = max(0, min(100, llm.match_percentage))
    return {
        "resume": filename,
        "candidate_name": llm.candidate_name,
        "email": email_match.group() if email_match else "",
        "similarity_score": pct / 100,
        "match_percentage": pct,
        "verdict": llm.verdict,
        "summary": llm.summary,
        "requirements": [r.model_dump() for r in llm.requirements],
        "strengths": llm.strengths,
        "weaknesses": llm.weaknesses,
        "missing_keywords": llm.missing_keywords,
        "interview_questions": llm.interview_questions,
        "learning_path": {
            "title": llm.learning_path.title,
            "description": llm.learning_path.description,
            "resources": verify_links([r.model_dump() for r in llm.learning_path.resources]),
        },
    }
