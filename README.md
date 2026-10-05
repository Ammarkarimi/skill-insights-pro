# SkillSphere 🚀

**Your AI-powered career companion.** Assess your skills, get recruiter-grade resume feedback, practise interviews, match yourself against real job descriptions, and plan your career, all powered by OpenAI.

The app is built to be hosted as a paid product. Users sign up, get free credits, and buy small credit packs through Stripe Checkout.

---

## ✨ Features

| Feature | What users get | Credits* |
|---|---|---|
| **Readiness Score** ⭐ | Set a target role (title, job description, optional resume) to get a weighted requirement scorecard. Every assessment, resume analysis and interview adds evidence. Shows a 0–100 readiness score, coverage, trend and next-best actions. Scoring itself is free | 2 per role |
| **Defend Your Resume** ⭐ | An adaptive interview that probes the claims on your resume for the target role with up to 2 follow-ups each. Verdicts: supported, weak or unsupported, with resume fixes, model answers and in-browser delivery stats (pace, fillers, pauses) | 3 + 3 |
| **Skill Portfolio** ⭐ | Proof that recruiters can trust. **Skill proofs** are 8-question adaptive tests (difficulty rises and falls with each answer, 90 s per question, graded on the server, one retake a day) that output a level. **Project reviews** read a public GitHub repo at a pinned commit and score it on a hiring rubric, with ownership verified by "Connect GitHub". A **public page** `/p/<slug>` (link-only and noindex by default) and embeddable SVG skill badges | 3 per proof, 5 per review |
| **Resume Tailor** ⭐ | Rewrites your resume for a job (or your target role) without inventing facts. Missing metrics become [placeholders], and a fact check flags any employer, school or figure not in the original. Editable, with free ATS-safe Word/PDF downloads | 4 |
| **Salary Negotiation** ⭐ | Role-play with an AI recruiter who has a hidden budget (enforced server-side). The debrief reveals the budget, how much of the room you captured, technique scores and ready-to-use scripts | 2 + 2 |
| **Cover Letters & Outreach** | Cover letter, recruiter email, LinkedIn note (≤300 chars), referral request or thank-you, built from your real resume, with free Word export | 1 |
| **Resume Analyzer** | Overall score plus 5 category scores, line-by-line rewrites highlighted in the resume, missing keywords and sections, PDF report. Optional target role or job description | 3 |
| **Skill Assessment** | Skills auto-detected from the resume (1 credit), 10 MCQs with code questions and explanations, per-skill breakdown. Graded on the server, so scores are trustworthy evidence | 2 |
| **Learning Path** | Focus areas from the user's actual mistakes, verified resource links, week-by-week plan, capstone project, PDF | 2 |
| **Practice Interview** | Spoken or typed answers. Each answer is scored /10 with strengths, gaps and a model answer, plus an overall readiness verdict. History is saved | 1 + 3 |
| **Job Match** | Ranks 1–10 resumes against a job description: requirement-by-requirement check, missing keywords, interview questions, learning plan | 2 / resume |
| **Career Paths** | Role recommendations with fit score, skill gaps, salary for the user's location, resources and a 30-day plan | 3 |
| **Job Market** | Live postings, salaries and top employers via Adzuna (optional), plus AI insights clearly labeled as estimates | 2 (cached for 6 h, free on repeat) |
| **Career Chatbot** | Context-aware career coach with Markdown answers | 1 / message |

⭐ Unique to SkillSphere. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the competitive analysis and roadmap.

\*Defaults; configurable with `ACTION_COSTS`. Credits are reserved before each AI call and **automatically refunded if it fails**.

## 🧱 Architecture

```
client/   React + Vite + Tailwind + shadcn/ui (SPA)
backend/  FastAPI · SQLAlchemy (Postgres/SQLite) · OpenAI Responses API (Structured Outputs) · Stripe
Dockerfile  builds the SPA and serves it from the API container (one origin, no CORS)
```

* **Auth:** email and password (bcrypt), session JWT in an httpOnly, `Secure`, `SameSite=Lax` cookie.
* **Billing:** prepaid credit packs through Stripe Checkout. A signed webhook and a return-URL confirmation both grant credits, idempotently.
* **AI quality:** every feature uses a Pydantic schema with OpenAI Structured Outputs, an expert system prompt with a calibrated rubric, and untrusted-input fencing against prompt injection. Resume highlights are located server-side from exact quotes, and dead resource links are swapped for working search links.
* **Privacy:** resumes are parsed in memory and never written to disk. Only interview feedback is stored, per user.
* **Abuse protection:** per-user AI rate limit, per-IP auth rate limit, 5 MB upload limit, text-length caps.

See [`docs/DEPLOYMENT_PLAN.md`](docs/DEPLOYMENT_PLAN.md) for the full review and the reasoning behind each change.

---

## 🛠 Local development

Prerequisites: Python 3.11+, Node 20+.

```bash
# 1. Backend (http://localhost:8000, API docs at /api/docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example .env          # then set OPENAI_API_KEY
uvicorn app.main:app --reload --port 8000

# 2. Frontend (http://localhost:8080, proxies /api to :8000)
cd client
npm ci
npm run dev
```

### Tests and checks

```bash
cd backend && ruff check app tests && pytest -q        # LLM and network are mocked
cd client  && npm run lint && npx tsc -p tsconfig.app.json --noEmit && npm run build
```

CI runs all of the above plus a Docker build (`.github/workflows/ci.yml`).

---

## 🚢 Deploying to production

The app ships as **one Docker image** that serves the API and the frontend. Any Docker host works (Render, Railway, Fly.io, Google Cloud Run, a VPS).

### 1. Required environment variables

| Variable | Notes |
|---|---|
| `ENVIRONMENT` | `production` (enables secure cookies and HSTS, hides API docs, validates config at startup). Set by the Dockerfile |
| `APP_URL` | Public `https://` URL, used for Stripe redirects |
| `JWT_SECRET` | `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `DATABASE_URL` | Postgres URL (`postgres://…` and `postgresql://…` both work) |
| `OPENAI_API_KEY` | Set a monthly **usage limit** in the OpenAI dashboard |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Purchases are disabled until both are set |

Optional: `OPENAI_MODEL`, `OPENAI_MODEL_FAST`, `OPENAI_REASONING_EFFORT`, `CURRENCY`, `FREE_SIGNUP_CREDITS`, `CREDIT_PACKS`, `ACTION_COSTS`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_TOKEN`, `WEB_CONCURRENCY`. See [`.env.example`](.env.example).

Build-time (Docker build args): `VITE_COMPANY_NAME`, `VITE_SUPPORT_EMAIL`, shown on the legal pages and in the footer.

### 2. Example: Render
1. Create a **PostgreSQL** instance and copy its *Internal Database URL*.
2. Create a **Web Service** from this repo with runtime **Docker**. Add the env vars above, with `DATABASE_URL` set to the Postgres URL.
3. Set the health check path to `/api/health`.

### 3. Stripe
1. In Stripe, go to **Developers → Webhooks → Add endpoint**: `https://YOUR_DOMAIN/api/billing/webhook`.
2. Select the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Test with Stripe test-mode keys and card `4242 4242 4242 4242` before switching to live keys.

Prices and currency are configured in the app (`CREDIT_PACKS`, `CURRENCY`), so no Stripe products need to be created. For INR, set `CURRENCY=inr` and give `price_cents` in paise.

### 4. GitHub (project ownership verification)
Project reviews work without this, but they are marked "not verified".
1. Go to GitHub **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Set the **Authorization callback URL** to `https://YOUR_DOMAIN/api/github/callback`.
3. Copy the client ID and a new client secret into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. The app only asks for the `read:user` scope and never stores the user's token.
4. Recommended: set `GITHUB_TOKEN` to a fine-grained token with **no permissions** (public read only). It raises the API limit from 60 to 5,000 requests an hour.

### 5. Try it locally with Docker + Postgres
```bash
cp .env.example .env    # fill in OPENAI_API_KEY (and Stripe test keys if you want purchases)
docker compose up --build
# open http://localhost:8000
```

### 6. Before launch checklist
- [ ] **Rotate every key that was previously committed** to this repo (Gemini API keys, LinkedIn client secret). They remain in git history.
- [ ] Review the Terms, Privacy and Refund pages (`client/src/pages/Legal.tsx`) for your jurisdiction.
- [ ] Set an OpenAI usage limit and Stripe email receipts.
- [ ] Run one real purchase in Stripe test mode end to end.

### Scaling notes
* The rate limiter and market cache are in-process. With several instances, move them to Redis.
* Tables are created automatically at startup. Adopt Alembic migrations before changing the schema.
* Each AI request is synchronous (10–60 s). Increase `WEB_CONCURRENCY` or instances for more concurrent users.

---

## 👨‍💻 Developed By

**Mohammed Ammar Karimi**<br>
💼 [LinkedIn](https://www.linkedin.com/in/mohammed-ammar)<br>
🌐 [Website](https://ammarkarimi.vercel.app/)<br>
📫 [Email](mailto:ammarkarimi9898@gmail.com)
