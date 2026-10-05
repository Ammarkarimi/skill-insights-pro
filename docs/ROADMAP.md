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
| 3 | Public **Skill Proof Portfolio**: adaptive-difficulty assessments, GitHub project review, shareable evidence page | ✅ Shipped |
| 4 | **Hiring journey toolkit** for job seekers: **application tracker** with stage checklists and prep kits; **online assessment practice** (verified aptitude tests, in-browser coding with a timed mock OA and code review); **STAR story bank** with drills; **learning loop** (saved plans, spaced review of mistakes, streaks, re-tests) | ✅ Shipped |
| 5 | Campus and bootcamp cohorts (placement cells see cohort readiness, pooled credits); India pack (Razorpay/UPI, INR micro-packs); email reminders for streaks and interview dates | Later |

Company-facing hiring tools are out of scope: they will be a separate product.

## How readiness is scored (Phase 1)
- **Per requirement:** a recency-weighted average of evidence (90-day half-life).
- **Source weights:**

  | Source | Weight |
  |---|---|
  | Skill proof (adaptive test) | 1.2 |
  | Project review | 1.2 |
  | Skill assessment | 1.0 |
  | Deep interview | 1.0 |
  | Practice interview | 0.7 |
  | Behavioral drill | 0.7 |
  | Aptitude test, coding practice | 0.6 |
  | Resume analysis | 0.5 |
  | Resume at setup | 0.4 |

- **Difficulty scaling:** assessment results are scaled by level (beginner ×0.7, intermediate ×0.9, advanced ×1.0).
- **Overall:** the weighted average across all requirements. **Unmeasured requirements count as 0**, so readiness has to be proven; coverage is shown alongside.
- **Cost:** scoring and next actions are deterministic, with no AI cost. Only the requirement extraction at setup uses the LLM.

## How proof works (Phase 3)
- **Skill proof:**
  - One AI call builds a pool of 15 questions, 5 per tier (beginner, intermediate, advanced).
  - The test serves 8 of them, starting at intermediate. A correct answer moves up a tier and a wrong one moves down.
  - Each question has 90 s (plus 15 s grace) on the server clock. Late answers count as wrong, and the answer key is only revealed after the last question.
  - **Proficiency** = 100 × mean(tier weight if correct), with weights 0.6 / 0.85 / 1.0.
  - **Level:**
    - Advanced: ≥2 correct at the advanced tier.
    - Intermediate: ≥2 correct at intermediate or above.
    - Beginner: ≥2 correct.
    - Otherwise Foundational.
  - One attempt per skill per 24 h. The public page shows the attempt count.
- **Project review:**
  - Reads a public repo at its default-branch head commit: README, manifests, CI, and up to 12 representative source files (about 80k characters), never stored.
  - Scores it on 6 rubric dimensions and maps the demonstrated skills to the target role.
  - Ownership:
    - **Owner:** the connected GitHub login owns the repo.
    - **Contributor:** the connected login has commits on the repo, shown with its commit share.
    - **Not verified:** neither applies.
- **Public portfolio:** private until published, and link-only (noindex) unless the owner allows indexing. It never shows email, and it hides private coaching (improvements, talking points). Badges are at `/api/public/portfolio/<slug>/badge.svg?skill=<skill>`.

## How the job-search toolkit works (Phase 4)
- **Application tracker:** stages are saved → applied → assessment → interview → offer (or rejected/withdrawn). The checklist grows with the furthest stage reached. The AI prep kit uses the job description and the user's weakest target requirements, and never states company facts the job description does not contain.
- **Aptitude tests:** 20 questions with 75 s each, answers saved one by one so the server enforces the deadline (30 s grace).
  - Quantitative and series-style logical items are generated by code; a test recomputes every answer independently.
  - Verbal and puzzle-style logical items come from the AI, then a second, independent solve must reproduce the key or the item is dropped.
- **Coding practice:** each problem's reference solution is run against every test case in CI. Code runs in a Web Worker in the browser (5 s limit, 10 s for Python), so pass counts are self-reported and never count as evidence on their own; only the AI review score does (capped at 60 when tests fail).
- **Story bank:** drafts use only resume facts; any figure the resume never stated is flagged. Drill questions come from a bank of 60, chosen for themes with no or weak stories.
- **Learning loop:** wrong answers from assessments, proofs and aptitude tests become review cards in Leitner boxes (due after 1, 3, 7, 14 and 30 days; a miss sends a card back to box 1). Any practice keeps the streak alive; the weekly goal is 5 practice days.
