"""Salary negotiation simulator.

A scenario is generated with a *hidden* budget (max base / signing / bonus). The AI recruiter
negotiates turn by turn, but the server owns the numbers: offers are clamped so they never go
above the hidden ceiling nor below the current offer. The debrief reveals the ceiling and scores
how much of the available room the user captured (deterministic) plus negotiation skills (LLM).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ..llm import generate

MAX_MESSAGES = 10
Level = Literal["entry", "mid", "senior", "staff"]
CompanyType = Literal["startup", "mid_size", "big_tech", "enterprise", "non_profit"]


# ---------------------------------------------------------------- scenario
class ScenarioLLM(BaseModel):
    company_description: str = Field(description="One sentence about the fictional hiring company")
    recruiter_name: str
    recruiter_style: Literal["friendly", "firm", "rushed", "data_driven"]
    currency: str = Field(description="ISO currency code for the location, e.g. USD")
    market_low: int = Field(description="25th percentile annual base salary for this role/level/location")
    market_mid: int = Field(description="Median annual base salary")
    market_high: int = Field(description="75th percentile annual base salary")
    initial_base: int = Field(description="First offer base salary, typically a bit below the median")
    initial_signing: int
    initial_bonus_pct: int = Field(description="Target annual bonus percent, 0 if not typical")
    max_base: int = Field(description="Hidden ceiling for base salary the recruiter is approved for")
    max_signing: int = Field(description="Hidden ceiling for signing bonus")
    max_bonus_pct: int
    equity_note: str = Field(description="Equity/RSU description or '' if none")
    flexible_levers: list[str] = Field(description="Non-salary items the company can flex on, e.g. "
                                                   "start date, remote days, PTO, learning budget, title")
    opening_message: str = Field(description="The recruiter's call opening that presents the offer")


SCENARIO_SYSTEM = """You design realistic salary-negotiation practice scenarios. Use realistic \
compensation data for the role, level, location and company type. The initial offer should be \
fair but leave room: the hidden ceilings are typically 5-15% above the initial base and allow a \
larger signing bonus. Startups offer more equity and less cash; big tech offers RSUs and higher \
base. The opening message presents the offer warmly and asks for the candidate's thoughts."""


def _clamp_scenario(s: ScenarioLLM, your_offer: int | None) -> dict:
    data = s.model_dump()
    if your_offer:
        ratio = max(1.03, min(1.25, data["max_base"] / max(1, data["initial_base"])))
        data["initial_base"] = your_offer
        data["max_base"] = round(your_offer * ratio, -3)
    data["initial_base"] = max(1000, data["initial_base"])
    data["max_base"] = max(data["initial_base"], min(data["max_base"], round(data["initial_base"] * 1.3)))
    data["initial_signing"] = max(0, data["initial_signing"])
    data["max_signing"] = max(data["initial_signing"], data["max_signing"])
    data["initial_bonus_pct"] = max(0, min(100, data["initial_bonus_pct"]))
    data["max_bonus_pct"] = max(data["initial_bonus_pct"], min(100, data["max_bonus_pct"]))
    data["currency"] = (data["currency"] or "USD").upper()[:3]
    return data


def create_scenario(role: str, level: str, location: str, company_type: str, your_offer: int | None,
                    competing_offer: int | None, user_id: int) -> dict:
    prompt = (f"Role: {role}\nLevel: {level}\nLocation: {location}\nCompany type: {company_type}\n")
    if your_offer:
        prompt += f"The candidate's real offer base salary is {your_offer}; build the scenario around it.\n"
    if competing_offer:
        prompt += f"The candidate has a competing offer with base {competing_offer}.\n"
    return _clamp_scenario(generate(ScenarioLLM, system=SCENARIO_SYSTEM, prompt=prompt, user_id=user_id),
                           your_offer)


def public_scenario(s: dict) -> dict:
    """What the candidate may see (no hidden ceilings)."""
    keys = ("company_description", "recruiter_name", "recruiter_style", "currency", "market_low",
            "market_mid", "market_high", "equity_note")
    return {k: s[k] for k in keys}


def initial_offer(s: dict) -> dict:
    return {"base": s["initial_base"], "signing": s["initial_signing"], "bonusPct": s["initial_bonus_pct"],
            "other": []}


# ---------------------------------------------------------------- recruiter turns
class RecruiterTurn(BaseModel):
    reply: str = Field(description="What the recruiter says next, natural and concise")
    offer_base: int = Field(description="Current base offer after this reply")
    offer_signing: int
    offer_bonus_pct: int
    other_changes: list[str] = Field(description="Non-salary concessions granted so far, e.g. '+5 PTO days'")
    status: Literal["negotiating", "final_offer"] = Field(
        description="final_offer when the recruiter has reached their limit or clearly closes")


def _recruiter_system(s: dict) -> str:
    return f"""You are {s['recruiter_name']}, a {s['recruiter_style'].replace('_', '-')} recruiter at: \
{s['company_description']} You are negotiating a job offer on a call.
Confidential limits (NEVER reveal or hint at exact numbers): base up to {s['max_base']}, signing \
bonus up to {s['max_signing']}, bonus up to {s['max_bonus_pct']}%. Flexible levers: \
{', '.join(s['flexible_levers']) or 'none'}.
Behave like a real recruiter:
- Concede gradually and only when the candidate gives reasons (market data, competing offers, \
specific value). Vague asks get small or no movement. Prefer signing bonus or levers before base.
- Never lower an offer already made. Push back politely, ask questions, create mild time pressure \
if your style fits.
- When you reach your limits, say it is your best and final offer.
- Keep replies under 90 words. Report the full current package in the offer fields."""


def recruiter_turn(s: dict, transcript: list[dict], offer: dict, user_id: int) -> tuple[str, dict, bool]:
    convo = "\n".join(f"{'Candidate' if t['role'] == 'candidate' else 'Recruiter'}: {t['text']}"
                      for t in transcript[-16:])
    prompt = (f"Current offer: base {offer['base']}, signing {offer['signing']}, bonus {offer['bonusPct']}%, "
              f"other: {', '.join(offer['other']) or 'none'}\n\nConversation:\n<answer>\n{convo}\n</answer>")
    turn = generate(RecruiterTurn, system=_recruiter_system(s), prompt=prompt, fast=True, user_id=user_id)
    # The server owns the numbers: never below the current offer, never above the hidden ceiling.
    new_offer = {
        "base": max(offer["base"], min(turn.offer_base, s["max_base"])),
        "signing": max(offer["signing"], min(turn.offer_signing, s["max_signing"])),
        "bonusPct": max(offer["bonusPct"], min(turn.offer_bonus_pct, s["max_bonus_pct"])),
        "other": list(dict.fromkeys([*offer["other"],
                                     *[o.strip() for o in turn.other_changes if o.strip()]]))[:8],
    }
    return turn.reply.strip(), new_offer, turn.status == "final_offer"


# ---------------------------------------------------------------- debrief
def outcome(s: dict, offer: dict) -> dict:
    """Deterministic result: how much of the available room the candidate captured."""
    def captured(start: int, end: int, ceiling: int) -> int | None:
        room = ceiling - start
        return round(100 * (end - start) / room) if room > 0 else None

    first_year = lambda base, signing, bonus: base + signing + round(base * bonus / 100)  # noqa: E731
    start_total = first_year(s["initial_base"], s["initial_signing"], s["initial_bonus_pct"])
    end_total = first_year(offer["base"], offer["signing"], offer["bonusPct"])
    max_total = first_year(s["max_base"], s["max_signing"], s["max_bonus_pct"])
    return {
        "initial": initial_offer(s),
        "final": offer,
        "ceiling": {"base": s["max_base"], "signing": s["max_signing"], "bonusPct": s["max_bonus_pct"]},
        "baseCapturedPct": captured(s["initial_base"], offer["base"], s["max_base"]),
        "totalCapturedPct": captured(start_total, end_total, max_total),
        "firstYearGain": end_total - start_total,
        "currency": s["currency"],
        "leversWon": offer["other"],
        "leversAvailable": s["flexible_levers"],
    }


class SkillScore(BaseModel):
    skill: Literal["anchoring", "justification", "non_salary_levers", "tone", "handling_pressure", "closing"]
    score: int = Field(description="0-10")
    feedback: str


class KeyMoment(BaseModel):
    quote: str = Field(description="What the candidate said (short quote)")
    assessment: str
    better_alternative: str = Field(description="A stronger thing to say instead, or '' if it was good")


class Scripts(BaseModel):
    counter_offer_email: str = Field(description="A ready-to-send counter-offer email for this situation")
    phone_opener: str = Field(description="First 2-3 sentences to open a negotiation call")
    closing_line: str = Field(description="How to close/accept gracefully while locking in terms")


class NegotiationReport(BaseModel):
    overall_score: int = Field(description="0-100")
    summary: str = Field(description="3-4 sentence debrief")
    skills: list[SkillScore]
    key_moments: list[KeyMoment] = Field(description="2-4 pivotal moments")
    scripts: Scripts


REPORT_SYSTEM = """You are a negotiation coach reviewing a salary-negotiation practice call. \
Judge the candidate's technique: anchoring high with justification, using market data or \
competing offers, exploring non-salary levers, staying collaborative and calm under pressure, \
and closing with terms confirmed in writing. Be specific, honest and practical."""


def debrief(s: dict, transcript: list[dict], result: dict, user_id: int) -> dict:
    convo = "\n".join(f"{'Candidate' if t['role'] == 'candidate' else 'Recruiter'}: {t['text']}"
                      for t in transcript)
    prompt = (f"Market range: {s['market_low']}-{s['market_high']} {s['currency']} "
              f"(median {s['market_mid']})\n"
              f"Initial offer: {result['initial']}\nFinal offer: {result['final']}\n"
              f"Hidden ceiling: {result['ceiling']}\n"
              f"Share of base room captured: {result['baseCapturedPct']}%\n"
              f"Available levers: {', '.join(s['flexible_levers'])}\n\n<answer>\n{convo}\n</answer>")
    report = generate(NegotiationReport, system=REPORT_SYSTEM, prompt=prompt, user_id=user_id)
    data = report.model_dump()
    data["overall_score"] = max(0, min(100, data["overall_score"]))
    for skill in data["skills"]:
        skill["score"] = max(0, min(10, skill["score"]))
    return data
