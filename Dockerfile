# ---------- 1. Build the React frontend ----------
FROM node:22-alpine AS frontend
WORKDIR /build
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
ARG VITE_COMPANY_NAME="Skill Sphere"
ARG VITE_SUPPORT_EMAIL="support@example.com"
ENV VITE_COMPANY_NAME=$VITE_COMPANY_NAME VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL
RUN npm run build

# ---------- 2. Python API that also serves the built frontend ----------
FROM python:3.11-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    ENVIRONMENT=production PORT=8000 WEB_CONCURRENCY=2
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/app ./app
COPY --from=frontend /build/dist /app/client/dist

RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/api/health', timeout=4)"

# --proxy-headers: trust X-Forwarded-* from the platform's load balancer (needed for client IPs/https).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY} --proxy-headers --forwarded-allow-ips='*'"]
