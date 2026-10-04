# SkillSphere: Competitive Analysis and Roadmap (Oct 2026)

## Landscape

| Competitor | Core strength | Price | Gap SkillSphere exploits |
|---|---|---|---|
| Teal | Resume tailoring, keyword scanner, job tracker | Free / ~$29/mo | No skill verification, weak interview practice |
| Jobscan | ATS match | $49.95/mo | Single-purpose, expensive |
| Rezi / Resume Worded / Kickresume | ATS resume builders | Subscriptions | Resume only |
| Final Round AI | Question library, live interview copilot, auto-apply | $25–150/mo | Copilot is a cheating risk; subscription complaints |
| Yoodli | Speech delivery analytics | $30–41/mo | Delivery only, not content or skills |
| Big Interview, InterviPrep, Mocki | Adaptive interviews with follow-ups | Subscriptions | Follow-ups are now table stakes |
| Careerflow | LinkedIn audit + application CRM | Subscription | No assessment or learning |
| LinkedIn Verified Skills (Jan 2026) | Badges from real tool usage | n/a | Covers a handful of AI tools only |

**Takeaways**
- Competitors are silos. None measures readiness for one target role over time.
- Skills are self-reported almost everywhere; the market is moving toward proof of work.
- Subscription fatigue is the top complaint. SkillSphere's pay-per-use credits are a differentiator.
- **Deliberately not built:** live interview copilots, auto-apply bots, LinkedIn scraping (ethics, ToS, reputation).

**Positioning:** *SkillSphere proves you're ready for the job you want, and shows you the shortest path there.*

## Roadmap

| Phase | Features | Status |
|---|---|---|
| 1 | Target-role **Readiness Score** (requirement scorecard, evidence from every feature, trend, next actions); **Defend Your Resume** adaptive interview with claim verification and delivery analytics; server-graded assessments | ✅ Shipped |
| 2 | **Resume Tailor** (honest rewrite, fact check, editable, DOCX/PDF export); **cover letter & outreach writer**; **salary-negotiation simulator** with a hidden, server-enforced budget | ✅ Shipped |
| 3 | Public **Skill Proof Portfolio**: adaptive-difficulty assessments, GitHub project review, shareable evidence page | Planned |
| 4 | Recruiter/campus (B2B) mode; India pack (aptitude tests, Razorpay/UPI, INR micro-packs) if the market focus changes | Later |

## How readiness is scored (Phase 1)
- **Per requirement:** a recency-weighted average of evidence (90-day half-life).
- **Source weights:**

  | Source | Weight |
  |---|---|
  | Skill assessment | 1.0 |
  | Deep interview | 1.0 |
  | Practice interview | 0.7 |
  | Resume analysis | 0.5 |
  | Resume at setup | 0.4 |

- **Difficulty scaling:** assessment results are scaled by level (beginner ×0.7, intermediate ×0.9, advanced ×1.0).
- **Overall:** the weighted average across all requirements. **Unmeasured requirements count as 0**, so readiness has to be proven; coverage is shown alongside.
- **Cost:** scoring and next actions are deterministic, with no AI cost. Only the requirement extraction at setup uses the LLM.
