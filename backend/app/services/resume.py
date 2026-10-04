"""Resume analysis and skill extraction."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field

from ..llm import generate


# ---------------------------------------------------------------- skill extraction
class ExtractedSkills(BaseModel):
    skills: list[str] = Field(description="Distinct technologies, languages, frameworks and tools, "
                                          "most prominent first, max 20, canonical names")
    category: Literal["Technology", "Data & AI", "Design", "Business", "Other"]
    primary_role: str = Field(description="Most likely current or target role, e.g. 'Backend Engineer'")
    seniority: Literal["student", "junior", "mid", "senior", "lead"]


SKILLS_SYSTEM = """You are a technical recruiter who extracts skills from resumes.
Return only skills the candidate demonstrably has (listed or used in projects/experience).
Use canonical names (e.g. "JavaScript", "React", "PostgreSQL", "AWS", "scikit-learn").
Do not include soft skills, spoken languages, or generic terms like "programming"."""


def extract_skills(resume_text: str, user_id: int) -> ExtractedSkills:
    result = generate(ExtractedSkills, system=SKILLS_SYSTEM, fast=True, user_id=user_id,
                      prompt=f"<resume>\n{resume_text}\n</resume>")
    seen: set[str] = set()
    unique = []
    for skill in result.skills:
        key = skill.strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(skill.strip())
    result.skills = unique[:20]
    return result


# ---------------------------------------------------------------- full analysis
class CategoryScore(BaseModel):
    score: int = Field(description="0-100")
    justification: str = Field(description="One or two specific sentences referencing the resume")


class Scores(BaseModel):
    word_choice: CategoryScore
    grammar: CategoryScore
    structure: CategoryScore
    content_relevance: CategoryScore
    ats_compatibility: CategoryScore


class Suggestion(BaseModel):
    original: str = Field(description="EXACT verbatim quote copied from the resume (5-200 chars). "
                                      "Must appear in the resume text character-for-character.")
    suggestion: str = Field(description="Improved replacement text, ready to paste")
    reason: str = Field(description="Why this change improves the resume (one or two sentences)")
    category: Literal["impact", "word_choice", "grammar", "formatting", "ats", "content"]
    severity: Literal["high", "medium", "low"]


class ResumeAnalysisLLM(BaseModel):
    overall_score: int = Field(description="0-100 holistic quality score")
    headline: str = Field(description="One-sentence verdict on the resume")
    summary: str = Field(description="3-4 sentence assessment a career coach would give")
    strengths: list[str] = Field(description="3-5 specific strengths")
    scores: Scores
    missing_sections: list[str] = Field(description="Important sections that are missing, if any")
    keywords_to_add: list[str] = Field(description="Up to 10 relevant keywords/skills the resume "
                                                   "should include for the target role")
    suggestions: list[Suggestion] = Field(description="6-12 high-impact, line-level edits")


ANALYSIS_SYSTEM = """You are a senior technical recruiter and certified resume writer who has \
reviewed 10,000+ resumes for top tech companies. Give rigorous, specific, actionable feedback.

Scoring rubric (be calibrated; most real resumes land between 55 and 80):
- 90-100: exceptional, quantified impact everywhere, flawless, perfectly targeted
- 75-89: strong, minor improvements possible
- 60-74: decent but generic or under-quantified
- 40-59: significant problems (vague bullets, poor structure, errors)
- 0-39: needs a rewrite

Suggestions rules:
- `original` MUST be an exact, verbatim substring of the resume (copy it precisely, including \
punctuation). Prefer whole bullet points or phrases, never a single common word.
- Prioritise: unquantified achievements (add metrics, use placeholders like [X%] if the number is \
unknown), weak verbs ("worked on", "responsible for", "helped"), passive voice, vague claims, \
grammar/spelling errors, and missing keywords for the target role.
- `suggestion` must be a concrete rewrite, not advice. Keep the candidate's facts; never invent \
employers, degrees or numbers (use [placeholders] instead).
- Order suggestions by impact, high severity first."""


_WS = re.compile(r"\s+")


def _find_span(text: str, quote: str, used: list[tuple[int, int]]) -> tuple[int, int] | None:
    """Find `quote` in `text`, tolerating whitespace/case differences. Skips overlapping spans."""
    quote = quote.strip().strip('"').strip()
    if len(quote) < 3:
        return None

    def free(start: int, end: int) -> bool:
        return all(end <= s or start >= e for s, e in used)

    # 1) exact match
    start = text.find(quote)
    while start != -1:
        if free(start, start + len(quote)):
            return start, start + len(quote)
        start = text.find(quote, start + 1)

    # 2) whitespace-insensitive, case-insensitive regex built from the quote's tokens
    tokens = [re.escape(t) for t in _WS.split(quote) if t]
    if not tokens:
        return None
    pattern = re.compile(r"\s*".join(tokens), re.IGNORECASE)
    for match in pattern.finditer(text):
        if free(match.start(), match.end()):
            return match.start(), match.end()
    return None


def analyze_resume(resume_text: str, target_role: str, job_description: str,
                   user_id: int) -> dict:
    target = ""
    if target_role:
        target += f"\nTarget role: {target_role}"
    if job_description:
        target += f"\n<job_description>\n{job_description[:8000]}\n</job_description>"
    if not target:
        target = "\nNo target role given: infer the most likely target role from the resume."

    prompt = f"{target}\n\n<resume>\n{resume_text}\n</resume>"
    llm = generate(ResumeAnalysisLLM, system=ANALYSIS_SYSTEM, prompt=prompt, user_id=user_id)

    used: list[tuple[int, int]] = []
    located, unlocated = [], []
    for s in llm.suggestions:
        span = _find_span(resume_text, s.original, used)
        item = {
            "original": s.original,
            "suggestion": s.suggestion,
            "reason": s.reason,
            "category": s.category,
            "severity": s.severity,
        }
        if span:
            used.append(span)
            item.update(startIndex=span[0], endIndex=span[1],
                        original=resume_text[span[0]:span[1]])
            located.append(item)
        else:
            # Still useful advice even if we cannot highlight it in the text.
            item.update(startIndex=-1, endIndex=-1)
            unlocated.append(item)

    clamp = lambda v: max(0, min(100, int(v)))  # noqa: E731
    scores = {name: {"score": clamp(cs.score), "justification": cs.justification}
              for name, cs in llm.scores}

    return {
        "text": resume_text,
        "overall_score": clamp(llm.overall_score),
        "headline": llm.headline,
        "summary": llm.summary,
        "strengths": llm.strengths,
        "scores": scores,
        "missing_sections": llm.missing_sections,
        "keywords_to_add": llm.keywords_to_add,
        "suggestions": sorted(located, key=lambda x: x["startIndex"]) + unlocated,
    }
