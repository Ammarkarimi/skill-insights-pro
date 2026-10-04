"""Tailor a resume to a job description without inventing facts.

The LLM rewrites, reorders and emphasises existing content. A deterministic fact check then
flags any employer, school or number in the output that does not appear in the original resume,
so the user can confirm or fix it before sending.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

from ..llm import generate


class Contact(BaseModel):
    name: str
    email: str
    phone: str
    location: str
    links: list[str] = Field(description="LinkedIn, GitHub, portfolio URLs found in the resume")


class SkillGroup(BaseModel):
    category: str
    items: list[str]


class Role(BaseModel):
    title: str
    company: str
    location: str
    start: str
    end: str
    bullets: list[str]


class Project(BaseModel):
    name: str
    tech: list[str]
    link: str
    bullets: list[str]


class Education(BaseModel):
    degree: str
    institution: str
    location: str
    start: str
    end: str
    details: str


class ResumeContent(BaseModel):
    """Editable, export-ready resume. Also used to validate user edits."""

    contact: Contact
    headline: str = Field(description="Target-role headline, e.g. 'Backend Engineer | Python, AWS'")
    summary: str = Field(description="2-3 sentence professional summary aimed at this job")
    skills: list[SkillGroup]
    experience: list[Role]
    projects: list[Project]
    education: list[Education]
    certifications: list[str]


class Change(BaseModel):
    section: str
    before: str = Field(description="Original text ('' if newly ordered/added from elsewhere in the resume)")
    after: str
    reason: str


class TailorLLM(BaseModel):
    resume: ResumeContent
    changes: list[Change] = Field(description="The 6-12 most important edits and why")
    keywords_added: list[str] = Field(description="Job keywords now present that the candidate truly has")
    keywords_missing: list[str] = Field(description="Important job keywords the resume cannot truthfully "
                                                    "claim; do NOT add these to the resume")


TAILOR_SYSTEM = """You are an expert resume writer tailoring a resume to one job description.

Hard rules (never break them):
- NEVER invent employers, titles, dates, degrees, certifications, projects, tools or numbers. \
Use only facts present in the original resume.
- Where a bullet would benefit from a metric the resume does not state, insert a placeholder \
such as [X%] or [N users] for the candidate to fill in. Never guess a number.
- Do not add a skill to the skills section unless the original resume shows it.

What to do:
- Rewrite bullets in strong action-verb + task + result form, mirroring the job's terminology \
where it truthfully applies.
- Reorder bullets, skills and projects so the most relevant to this job come first; trim or \
drop clearly irrelevant items (keep every employer and degree).
- Write a targeted headline and summary.
- Keep it to roughly one page of content for under 10 years of experience, two pages otherwise.
- Use '' for missing contact fields. Keep dates exactly as written in the original."""


def tailor(resume_text: str, job_title: str, company: str, job_description: str,
           user_id: int) -> TailorLLM:
    prompt = (f"Target job: {job_title or 'see job description'}"
              f"{f' at {company}' if company else ''}\n"
              f"<job_description>\n{job_description}\n</job_description>\n\n"
              f"<resume>\n{resume_text}\n</resume>")
    return generate(TailorLLM, system=TAILOR_SYSTEM, prompt=prompt, user_id=user_id)


# ---------------------------------------------------------------- fact check
_NUM = re.compile(r"(?<![\w\[])(\$?\d[\d,.]*\s?(?:%|k|m|x|\+)?)", re.IGNORECASE)


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9%$]+", " ", text.lower()).strip()


def _num_key(raw: str) -> str:
    return re.sub(r"[\s,]", "", raw.lower()).rstrip(".")


def source_facts(original: str, content: ResumeContent) -> dict:
    """What we keep from the original resume to re-check edits later (never the resume itself):
    the set of figures it contains and any entity in the tailored output it does not contain."""
    source = f" {_norm(original)} "

    def missing(value: str) -> bool:
        value = _norm(value)
        return bool(value) and f" {value} " not in source and value not in source

    entities = [{"kind": "Employer", "value": r.company} for r in content.experience if missing(r.company)]
    entities += [{"kind": "Institution", "value": e.institution} for e in content.education
                 if missing(e.institution)]
    entities += [{"kind": "Certification", "value": c} for c in content.certifications if missing(c)]
    return {"numbers": sorted({_num_key(n) for n in _NUM.findall(original)}), "entities": entities}


def warnings_for(facts: dict, content: ResumeContent) -> list[str]:
    """Current warnings for (possibly user-edited) content."""
    present = {_norm(r.company) for r in content.experience} | \
              {_norm(e.institution) for e in content.education} | {_norm(c) for c in content.certifications}
    warnings = [f"{e['kind']} \"{e['value']}\" was not found in your original resume."
                for e in facts.get("entities", []) if _norm(e["value"]) in present]

    known = set(facts.get("numbers", []))
    seen: set[str] = set()
    texts = [content.summary] + [b for r in content.experience for b in r.bullets] + \
            [b for p in content.projects for b in p.bullets]
    for text in texts:
        for raw in _NUM.findall(text):
            key = _num_key(raw)
            if key and key not in known and key not in seen:
                seen.add(key)
                warnings.append(f"The figure \"{raw.strip()}\" is not in your original resume. "
                                "Make sure it is accurate before sending.")
    return warnings


def fact_check(original: str, content: ResumeContent) -> list[str]:
    return warnings_for(source_facts(original, content), content)
