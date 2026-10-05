import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ.update({
    "ENVIRONMENT": "test",
    "DATABASE_URL": f"sqlite:///{_tmp}/test.db",
    "JWT_SECRET": "test-secret-test-secret-test-secret-1234",
    "OPENAI_API_KEY": "sk-test",
    "FREE_SIGNUP_CREDITS": "10",
    "SERVE_FRONTEND": "false",
    "STRIPE_SECRET_KEY": "",
    "STRIPE_WEBHOOK_SECRET": "",
    "ADZUNA_APP_ID": "",
    "ADZUNA_APP_KEY": "",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import links  # noqa: E402
from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.ratelimit import limiter  # noqa: E402


@pytest.fixture(autouse=True)
def _clean_state(monkeypatch):
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    limiter.reset()
    # Never hit the network for link checks in tests.
    monkeypatch.setattr(links, "url_is_alive", lambda url, client: "dead" not in url)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register(client, email="ada@example.com", password="correct-horse-1"):
    r = client.post("/api/auth/register", json={"email": email, "password": password, "name": "Ada"})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def user(client):
    return register(client)


class FakeLLM:
    """Replaces `generate` in a service module; returns queued objects or raises."""

    def __init__(self):
        self.calls = []
        self.queue = []

    def push(self, value):
        self.queue.append(value)

    def __call__(self, schema, **kwargs):
        self.calls.append((schema, kwargs))
        value = self.queue.pop(0)
        if isinstance(value, Exception):
            raise value
        return value if isinstance(value, schema) else schema.model_validate(value)


@pytest.fixture
def fake_llm(monkeypatch):
    from app.services import (
        applications,
        assessment,
        career,
        chat,
        deep_interview,
        interview,
        job_match,
        letters,
        market,
        negotiation,
        project_review,
        proof,
        readiness,
        resume,
        tailor,
    )

    fake = FakeLLM()
    for module in (applications, assessment, career, chat, deep_interview, interview, job_match, letters,
                   market, negotiation, project_review, proof, readiness, resume, tailor):
        monkeypatch.setattr(module, "generate", fake)
    return fake
