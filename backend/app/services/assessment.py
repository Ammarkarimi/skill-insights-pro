"""Skill-assessment MCQs and the personalised learning path."""

from __future__ import annotations

import random
from typing import Literal

from fastapi import HTTPException, status
from pydantic import BaseModel, Field

from ..links import verify_links
from ..llm import generate

Difficulty = Literal["beginner", "intermediate", "advanced"]

DIFFICULTY_GUIDE = {
    "beginner": "0-2 years experience: core concepts, syntax, common APIs, basic debugging.",
    "intermediate": "2-5 years: design trade-offs, performance, idioms, testing, real-world bugs.",
    "advanced": "5+ years: internals, concurrency, scalability, security, architecture decisions.",
}


class MCQOption(BaseModel):
    key: Literal["A", "B", "C", "D"]
    text: str


class MCQ(BaseModel):
    question: str
    code: str = Field(description="Code snippet for the question, or empty string if none")
    options: list[MCQOption] = Field(description="Exactly four options A-D")
    answer: Literal["A", "B", "C", "D"]
    explanation: str = Field(description="Why the answer is correct and the others are not (2-3 sentences)")
    topic: str = Field(description="Specific sub-topic tested, e.g. 'React useEffect cleanup'")
    skill: str = Field(description="Which of the requested skills this question tests")


class MCQSet(BaseModel):
    questions: list[MCQ]


MCQ_SYSTEM = """You are a principal engineer who writes technical interview assessments.
Write rigorous multiple-choice questions that test real understanding, not trivia.

Rules:
- Exactly one option is unambiguously correct; distractors must be plausible misconceptions.
- Make options similar in length and style so the answer is not guessable from form.
- About a third of the questions should include a short, correct, runnable code snippet in \
`code` (asking what it outputs, what bug it has, or how to fix it). Otherwise `code` is "".
- Spread questions across all requested skills and across different sub-topics; no duplicates.
- Questions must be accurate for current stable versions of each technology.
- Do not reference "the code above" unless `code` is non-empty."""


def generate_questions(skills: list[str], difficulty: Difficulty, count: int,
                       user_id: int) -> list[dict]:
    prompt = (
        f"Skills to assess: {', '.join(skills)}\n"
        f"Difficulty: {difficulty} ({DIFFICULTY_GUIDE[difficulty]})\n"
        f"Number of questions: {count}"
    )
    result = generate(MCQSet, system=MCQ_SYSTEM, prompt=prompt, user_id=user_id)

    questions = []
    for q in result.questions:
        options = {o.key: o.text.strip() for o in q.options}
        if (set(options) != {"A", "B", "C", "D"} or q.answer not in options
                or len(set(options.values())) < 4):
            continue  # drop malformed items rather than show a broken question
        # Shuffle option order so the correct letter is evenly distributed.
        texts = [options[k] for k in "ABCD"]
        correct_text = options[q.answer]
        random.shuffle(texts)
        shuffled = dict(zip("ABCD", texts, strict=False))
        answer = next(k for k, v in shuffled.items() if v == correct_text)
        questions.append({
            "id": len(questions) + 1,
            "question": q.question.strip(),
            "code": q.code.strip() or None,
            "options": shuffled,
            "answer": answer,
            "explanation": q.explanation,
            "topic": q.topic,
            "skill": q.skill,
        })
        if len(questions) == count:
            break

    if len(questions) < max(3, count // 2):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            "Could not generate a valid assessment. You were not charged; please retry.")
    return questions


# ---------------------------------------------------------------- learning path
class Resource(BaseModel):
    title: str
    type: Literal["course", "documentation", "tutorial", "video", "book", "project", "practice"]
    provider: str = Field(description="e.g. 'MDN', 'freeCodeCamp', 'Coursera', 'official docs'")
    link: str = Field(description="Direct URL. Prefer official docs and well-known stable URLs.")
    description: str = Field(description="What it teaches and why it fits this learner")
    focus_area: str = Field(description="Which focus area this resource addresses")
    estimated_hours: int
    free: bool


class FocusArea(BaseModel):
    topic: str
    why: str = Field(description="Evidence from the assessment showing this is a gap")
    priority: Literal["high", "medium", "low"]


class WeekPlan(BaseModel):
    week: int
    goal: str
    activities: list[str]


class LearningPathLLM(BaseModel):
    title: str
    summary: str = Field(description="3-4 sentences: where the learner stands and the strategy")
    strengths: list[str]
    focus_areas: list[FocusArea]
    resources: list[Resource] = Field(description="6-9 resources, ordered as a learning sequence")
    weekly_plan: list[WeekPlan] = Field(description="A 4-6 week plan")
    capstone_project: str = Field(description="One portfolio project idea that proves the skills")


PATH_SYSTEM = """You are an expert technical mentor who designs personalised learning plans.
Base every recommendation on the learner's actual mistakes in the assessment.

Resource rules:
- Recommend resources that really exist, from reputable providers: official documentation, \
MDN, freeCodeCamp, The Odin Project, roadmap.sh, Coursera, edX, Khan Academy, Real Python, \
Kaggle Learn, fast.ai, Full Stack Open, LeetCode/HackerRank/Exercism for practice, and \
well-known books.
- Use the most stable URL you are confident exists (e.g. the docs page or course landing page). \
Never invent deep links you are unsure about; link to the provider's page for that topic instead.
- Prefer free resources; mark paid ones with free=false.
- Match the difficulty to the learner's level and score."""


def build_learning_path(skills: list[str], difficulty: str, score: int,
                        results: list[dict], user_id: int) -> dict:
    lines = []
    for i, r in enumerate(results, 1):
        status_txt = "CORRECT" if r.get("is_correct") else "WRONG"
        lines.append(
            f"{i}. [{status_txt}] ({r.get('topic') or r.get('skill') or 'general'}) "
            f"{r.get('question', '')[:400]} | learner answered: {r.get('user_answer') or 'no answer'}"
            f" | correct: {r.get('correct_answer', '')}"
        )
    prompt = (
        f"Skills assessed: {', '.join(skills)}\nLevel attempted: {difficulty}\n"
        f"Score: {score}%\n\nQuestion-by-question results:\n" + "\n".join(lines)
    )
    llm = generate(LearningPathLLM, system=PATH_SYSTEM, prompt=prompt, user_id=user_id)

    resources = verify_links([r.model_dump() for r in llm.resources])
    return {
        "title": llm.title,
        "summary": llm.summary,
        "strengths": llm.strengths,
        "focusAreas": [f.model_dump() for f in llm.focus_areas],
        "learningPath": resources,
        "weeklyPlan": [w.model_dump() for w in llm.weekly_plan],
        "capstoneProject": llm.capstone_project,
    }
