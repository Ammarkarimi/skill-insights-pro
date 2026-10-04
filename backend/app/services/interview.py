"""Mock-interview question generation and answer evaluation."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ..llm import generate


class InterviewQuestion(BaseModel):
    question: str = Field(description="Spoken-style question, 1-3 sentences, no code blocks")
    focus: str = Field(description="What the question evaluates, e.g. 'API design trade-offs'")
    type: Literal["technical", "scenario", "behavioral", "system_design"]


class InterviewQuestionSet(BaseModel):
    questions: list[InterviewQuestion]


QUESTIONS_SYSTEM = """You are an experienced hiring manager running a realistic mock interview.
Write questions that are answered verbally (no whiteboard coding). Mix conceptual, scenario-based \
and one behavioural question. Start easier and build up. Calibrate to the difficulty:
- beginner: fundamentals and simple scenarios (entry-level roles)
- intermediate: trade-offs, debugging stories, design decisions (mid-level)
- advanced: architecture, scaling, leadership and ambiguity (senior/staff)
No duplicate or overlapping questions."""


def generate_interview_questions(topic: str, difficulty: str, count: int,
                                 user_id: int) -> list[dict]:
    result = generate(
        InterviewQuestionSet, system=QUESTIONS_SYSTEM, fast=True, user_id=user_id,
        prompt=f"Role/topic: {topic}\nDifficulty: {difficulty}\nNumber of questions: {count}",
    )
    return [q.model_dump() for q in result.questions[:count]]


class AnswerFeedback(BaseModel):
    score: int = Field(description="0-10")
    verdict: Literal["excellent", "good", "fair", "weak", "no_answer"]
    strengths: list[str]
    improvements: list[str] = Field(description="Specific missing points or mistakes")
    model_answer: str = Field(description="A concise, strong answer (80-150 words)")


class OverallFeedback(BaseModel):
    overall_score: int = Field(description="0-100")
    readiness: Literal["ready", "almost_ready", "needs_practice", "not_ready"]
    summary: str = Field(description="3-4 sentence debrief like a real interviewer would give")
    communication: str = Field(description="Feedback on clarity, structure and confidence")
    top_strengths: list[str]
    focus_next: list[str] = Field(description="3 concrete things to practise next")


class InterviewEvaluation(BaseModel):
    answers: list[AnswerFeedback] = Field(description="One entry per question, same order")
    overall: OverallFeedback


EVAL_SYSTEM = """You are a fair but demanding senior interviewer giving feedback on a mock \
interview. Answers were transcribed from speech, so ignore filler words, transcription errors \
and missing punctuation; judge the substance and structure.

Scoring per answer (0-10): 9-10 complete, precise, with examples; 7-8 solid with small gaps; \
5-6 partially correct or shallow; 3-4 major gaps or errors; 1-2 mostly wrong; 0 no answer.
Use verdict "no_answer" with score 0 when the answer is empty or unrelated.
Be specific: name the exact concepts that were missing or wrong. Encourage, but never inflate."""


def evaluate_interview(topic: str, difficulty: str, qa: list[dict], user_id: int) -> dict:
    blocks = []
    for i, item in enumerate(qa, 1):
        answer = (item.get("answer") or "").strip() or "(no answer)"
        blocks.append(f"Q{i}: {item['question']}\n<answer>\n{answer[:4000]}\n</answer>")
    prompt = f"Role/topic: {topic}\nDifficulty: {difficulty}\n\n" + "\n\n".join(blocks)
    result = generate(InterviewEvaluation, system=EVAL_SYSTEM, prompt=prompt, user_id=user_id)

    answers = []
    for i, item in enumerate(qa):
        fb = result.answers[i] if i < len(result.answers) else None
        answers.append({
            "question": item["question"],
            "userAnswer": item.get("answer", ""),
            "score": max(0, min(10, fb.score)) if fb else 0,
            "verdict": fb.verdict if fb else "no_answer",
            "strengths": fb.strengths if fb else [],
            "improvements": fb.improvements if fb else [],
            "modelAnswer": fb.model_answer if fb else "",
        })
    overall = result.overall.model_dump()
    overall["overall_score"] = max(0, min(100, overall["overall_score"]))
    return {"topic": topic, "difficulty": difficulty, "answers": answers, "overall": overall}
