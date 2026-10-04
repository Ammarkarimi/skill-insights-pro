# SkillSphere: Deployment-Readiness Plan

This plan comes from a full review of the `master` code (Flask `app.py` + Vite/React `client/`).
The goal is a hosted, pay-per-use product running on OpenAI, with output good enough to charge for.

## 1. What the review found

### Blockers (security and privacy)
| # | Finding | Impact |
|---|---------|--------|
| S1 | Three Google Gemini API keys hardcoded in `app.py`; LinkedIn `CLIENT_SECRET` committed in `.env` | Leaked credentials. **They must be revoked.** Removing them from the code does not remove them from git history |
| S2 | A real resume PDF (`uploads/`) and interview transcripts (`interviews/`) are committed | Personal data sits in the repo |
| S3 | All uploaded resumes go into one shared `uploads/` folder. `/check_similarity_job` scores *every* file in it, and `/view_resume_job` serves any file by name | Every user sees every other user's resumes |
| S4 | Global mutable state (`job_description`, `questions_answers`, `chat_history`) is shared by all users | Users overwrite each other's sessions; chat history leaks between users |
| S5 | No authentication, no rate limits, no upload size limits, `debug=True` | Anyone can run up the LLM bill, and the server allows remote code execution through the Werkzeug debugger |
| S6 | Network Analysis page hardcodes a real person's name, email and LinkedIn photo, and presents mock data as theirs | Personal data exposure and misleading content |

### Broken functionality
| # | Feature | Problem |
|---|---------|---------|
| F1 | Job Market | `/api/job-market` is a Next.js API route, but this is a Vite app, so it never runs and the page always shows hardcoded sample data. Location data comes from scraping Indeed/LinkedIn/Glassdoor, which is blocked in practice and against their ToS. Salaries are single-number LLM guesses |
| F2 | Job Assessment | The frontend **overwrites** the real analysis with placeholder strengths, weaknesses and a fake `example.com` learning path |
| F3 | Practice Interview | Answers are "graded" with TF-IDF similarity, not real feedback. The evaluation call goes to `process.env.NEXT_PUBLIC_API_URL` (undefined in Vite). Speech-only input fails in Firefox and Safari |
| F4 | Skill Assessment | Stale-state bug: the first "Continue" on difficulty never advances, because `questions.length` is read before the state update. The learning path HEAD-checks LLM-invented URLs and often drops every resource |
| F5 | Resume Analyzer | Asks the LLM for character offsets, which it can't produce reliably, so highlights land in the wrong place. The prompt asks for category scores, then throws them away. "Download as PDF" does nothing. The fallback returns a tuple `(suggestions, None)`, which crashes the UI |
| F6 | Path Recommendation | "Profile strength 75%" and "+30% jobs" are hardcoded. There's no career goal input |
| F7 | Login/Register | Dialogs are UI-only; nothing is wired up |
| F8 | API base URL | `localhost:5000` / `127.0.0.1:5000` is hardcoded in 13 places |
| F9 | README | Describes a `backend/` folder, `main.py` and FastAPI, none of which exist |

## 2. Target architecture

```
                ┌────────────────────────── single container ──────────────────────────┐
 Browser ──────▶│ FastAPI (gunicorn + uvicorn workers)                                 │
  (React SPA)   │   /api/auth/*      email + password, JWT in httpOnly cookie          │
                │   /api/billing/*   Stripe Checkout credit packs + signed webhook     │
                │   /api/resume/*    analyze, extract skills                           │
                │   /api/assessment/* MCQs, learning path                              │
                │   /api/interview/* questions, LLM evaluation, history               │
                │   /api/job-match/* resume ↔ JD ranking (in-memory, never stored)     │
                │   /api/career/*    path recommendations                              │
                │   /api/market/*    Adzuna live data (optional) + AI insights         │
                │   /api/chat        career assistant                                  │
                │   /*               built React app (SPA fallback)                    │
                └───────────┬───────────────────────────┬──────────────────────────────┘
                            │                           │
                   Postgres (DATABASE_URL)        OpenAI Responses API
                   SQLite for local dev           (Structured Outputs)
```

* **One container, same origin.** No CORS in production; cookies just work. It deploys to Render, Railway, Fly.io, Cloud Run or any Docker host.
* **Monetization: prepaid credits.** New users get a few free credits (`FREE_SIGNUP_CREDITS`). Each AI action costs credits. Users buy packs through Stripe Checkout, and a signed webhook adds the credits idempotently. Credits are reserved atomically before the LLM call and **refunded automatically if the call fails**, so users never pay for errors.
* **Privacy by default.** Resumes are parsed in memory and never written to disk.

## 3. Output quality (the artifacts users pay for)

* All LLM calls go through one wrapper using **OpenAI Structured Outputs** (`responses.parse` + Pydantic schemas). That removes the fragile ```` ```json ```` stripping and the hardcoded fallback data.
* Model choice is configurable (`OPENAI_MODEL` for high-value artifacts, `OPENAI_MODEL_FAST` for chat and extraction). The reasoning-effort setting is optional.
* Expert-written system prompts for each feature, with explicit rubrics and calibrated scoring guidance. Resume and job text is fenced as untrusted data to resist prompt injection.
* **Resume analysis:** the LLM returns exact quotes, and the server finds their offsets (whitespace-tolerant), so highlights are always correct. Response includes 5 category scores with justifications, an overall score, strengths, and severity/category on every suggestion. Users can download a PDF report.
* **Learning resources:** URLs are verified concurrently. A dead or hallucinated link is replaced with a working search link for that resource, so the user never gets a broken link and resources are never silently dropped.
* **Interviews:** an LLM grades each answer (score /10, strengths, gaps, model answer) plus an overall readiness verdict. Users can type answers when speech recognition is unavailable. History is saved per user.
* **MCQs:** validated answer keys, an explanation per question, and a topic tag per question, which feed a targeted learning path.
* **Job market:** real counts, salaries, salary history and top employers from the Adzuna API when keys are configured. AI insights are always labeled as estimates. The app never presents fabricated numbers as live data.

## 4. Execution checklist

- [x] P0: Remove hardcoded secrets, committed PII, and runtime artifacts; add `.gitignore` and `.env.example`
- [x] P1: New `backend/` FastAPI package: config, DB models, auth, credits, rate limiting, upload validation
- [x] P2: OpenAI wrapper and per-feature services with structured schemas and quality prompts
- [x] P3: Stripe billing: packs, checkout, webhook, purchase history
- [x] P4: Frontend: central API client, auth context, protected routes, credit balance, login/register/pricing pages
- [x] P5: Frontend: fix and upgrade every feature page (bugs F2–F6) and remove the fake Network Analysis feature
- [x] P6: Legal pages (Terms, Privacy, Refunds) required by payment processors. **The owner must review them**
- [x] P7: Dockerfile (multi-stage), docker-compose with Postgres, health check, CI workflow
- [x] P8: Backend test suite (LLM mocked) and frontend typecheck/lint/build passing
- [x] P9: README with local setup and production deployment steps

## 5. What the owner must still do (cannot be done from code)

1. **Rotate every leaked key** (Gemini keys, LinkedIn client secret). They remain in git history; consider rewriting history or making the repo private.
2. Create an OpenAI API key with a monthly **usage limit** set in the OpenAI dashboard.
3. Create a Stripe account, get keys, and add a webhook endpoint `https://<domain>/api/billing/webhook` for `checkout.session.completed`.
4. (Optional) Get free Adzuna API keys for live job-market data.
5. Have the Terms, Privacy and Refund pages reviewed for your jurisdiction.
6. Set `JWT_SECRET` to a long random value and `APP_URL` to your public URL.

## 6. Recommended follow-ups (post-launch)
* Password reset and email verification (needs an email provider such as Resend or SES).
* Alembic migrations once the schema starts changing (tables are created at startup today).
* Redis-backed rate limiting if you run more than one instance.
* Error monitoring (Sentry) and per-user cost dashboards from the `usage_events` table.
* Razorpay as an alternative payment provider if you are targeting India.
