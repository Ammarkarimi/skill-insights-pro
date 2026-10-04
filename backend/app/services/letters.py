"""Cover letters and outreach messages grounded in the candidate's real resume."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field

from ..llm import generate

LetterType = Literal["cover_letter", "recruiter_email", "linkedin_note", "referral_request", "thank_you"]
Tone = Literal["professional", "warm", "concise", "enthusiastic"]

LINKEDIN_LIMIT = 300

GUIDES: dict[str, str] = {
    "cover_letter": "A cover letter of 250-350 words in 3-4 short paragraphs: a specific hook tied to the "
                    "company or role, 2 concrete achievements mapped to the job's top needs, why this "
                    "company, and a confident close. Subject is ''.",
    "recruiter_email": "A cold email to a recruiter or hiring manager, under 150 words, with a specific "
                       "subject line under 8 words, one standout achievement, and a clear, low-friction ask.",
    "linkedin_note": f"A LinkedIn connection note under {LINKEDIN_LIMIT} characters including spaces. "
                     "Personal, specific, no hard sell. Subject is ''.",
    "referral_request": "A message asking a contact at the company for a referral, under 150 words. Make "
                        "it easy to say yes: why you fit in one line, the exact role, and an offer to send a "
                        "blurb they can forward. Include a short subject line.",
    "thank_you": "A post-interview thank-you email under 150 words that references something specific "
                 "from the conversation (from the notes), reinforces one strength, and is gracious. "
                 "Include a short subject line.",
}


class LetterLLM(BaseModel):
    subject: str
    body: str = Field(description="Plain text; paragraphs separated by a blank line; no placeholders "
                                  "except [Hiring Manager] when no recipient name is known")
    highlights_used: list[str] = Field(description="The resume facts this message relies on")
    personalization_tips: list[str] = Field(
        description="2-3 ways to make it even more specific before sending")


LETTER_SYSTEM = """You are an expert career writer. Write messages that sound like a confident, \
genuine human, not a template.
Rules:
- Use ONLY achievements, skills and experience present in the resume. Never invent facts, numbers, \
company knowledge or mutual connections.
- No cliches such as "I am writing to express my interest", "I believe I would be a great fit", \
"passionate", "synergy", "team player".
- Lead with what the reader cares about. Be specific and concise. Match the requested tone.
- Sign off with the candidate's name from the resume."""


def _fit_linkedin(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= LINKEDIN_LIMIT:
        return text
    cut = text[:LINKEDIN_LIMIT]
    end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    return cut[: end + 1] if end > 120 else cut.rsplit(" ", 1)[0].rstrip(",;:") + "…"


def write(kind: LetterType, tone: Tone, resume_text: str, job_title: str, company: str,
          job_description: str, recipient: str, notes: str, user_id: int) -> dict:
    prompt = (f"Message type: {kind}\nInstructions: {GUIDES[kind]}\nTone: {tone}\n"
              f"Role: {job_title or 'not specified'}\nCompany: {company or 'not specified'}\n"
              f"Recipient: {recipient or 'unknown'}\n")
    if notes:
        prompt += f"<notes>\n{notes}\n</notes>\n"
    if job_description:
        prompt += f"<job_description>\n{job_description}\n</job_description>\n"
    prompt += f"<resume>\n{resume_text}\n</resume>"
    result = generate(LetterLLM, system=LETTER_SYSTEM, prompt=prompt, fast=kind == "linkedin_note",
                      user_id=user_id)

    body = result.body.strip()
    subject = result.subject.strip()
    if kind == "linkedin_note":
        body, subject = _fit_linkedin(body), ""
    elif kind == "cover_letter":
        subject = ""
    return {
        "type": kind,
        "subject": subject,
        "body": body,
        "wordCount": len(body.split()),
        "charCount": len(body),
        "highlights": result.highlights_used,
        "tips": result.personalization_tips,
    }
