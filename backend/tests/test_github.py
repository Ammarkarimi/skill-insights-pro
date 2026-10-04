import httpx
import pytest

from app.config import get_settings
from app.db import SessionLocal
from app.models import GithubAccount
from app.services import github as gh
from tests.conftest import register


@pytest.fixture
def oauth(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "github_client_id", "cid")
    monkeypatch.setattr(s, "github_client_secret", "csecret")
    seen = {"token_requests": [], "user": {"id": 4242, "login": "janedoe", "name": "Jane",
                                           "avatar_url": "https://avatars.example/j"}}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/login/oauth/access_token":
            seen["token_requests"].append(request.content.decode())
            if b"code=bad" in request.content:
                return httpx.Response(200, json={"error": "bad_verification_code"})
            return httpx.Response(200, json={"access_token": "gho_secret_token", "token_type": "bearer"})
        if request.url.path == "/user":
            assert request.headers["authorization"] == "Bearer gho_secret_token"
            return httpx.Response(200, json=seen["user"])
        return httpx.Response(404)

    monkeypatch.setattr(gh, "http_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    return seen


def connect(client, code="good"):
    url = client.get("/api/github/connect").json()["url"]
    state = httpx.URL(url).params["state"]
    return client.get("/api/github/callback", params={"code": code, "state": state}, follow_redirects=False)


def test_status_when_not_configured(client, user):
    body = client.get("/api/github/status").json()
    assert body == {"enabled": False, "connected": False, "login": None, "avatarUrl": None,
                    "connectedAt": None}
    assert client.get("/api/github/connect").status_code == 503


def test_connect_flow_links_identity_without_storing_token(client, user, oauth):
    url = client.get("/api/github/connect").json()["url"]
    params = httpx.URL(url).params
    assert params["scope"] == "read:user" and params["client_id"] == "cid"
    assert params["redirect_uri"].endswith("/api/github/callback")
    r = connect(client)
    assert r.status_code == 303 and r.headers["location"] == "/portfolio?github=connected"
    body = client.get("/api/github/status").json()
    assert body["connected"] and body["login"] == "janedoe"
    with SessionLocal() as db:
        row = db.query(GithubAccount).one()
        assert row.github_id == 4242
        assert "gho_secret_token" not in repr(row.__dict__)
    assert "client_secret=csecret" in oauth["token_requests"][0]


def test_bad_state_or_code_is_rejected(client, user, oauth):
    r = client.get("/api/github/callback", params={"code": "good", "state": "forged"},
                   follow_redirects=False)
    assert r.headers["location"] == "/portfolio?github=error"
    assert connect(client, code="bad").headers["location"] == "/portfolio?github=error"
    # A state minted for another user is rejected too.
    other_state = gh.make_state(user["id"] + 1)
    r = client.get("/api/github/callback", params={"code": "good", "state": other_state},
                   follow_redirects=False)
    assert r.headers["location"] == "/portfolio?github=error"
    assert client.get("/api/github/status").json()["connected"] is False


def test_signed_out_callback_goes_to_login(client, oauth):
    r = client.get("/api/github/callback", params={"code": "x", "state": "y"}, follow_redirects=False)
    assert r.headers["location"] == "/login"


def test_identity_cannot_back_two_accounts(client, user, oauth):
    connect(client)
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert connect(client).headers["location"] == "/portfolio?github=taken"
    assert client.get("/api/github/status").json()["connected"] is False


def test_reconnect_updates_and_disconnect(client, user, oauth):
    connect(client)
    oauth["user"]["login"] = "jane-renamed"
    connect(client)
    assert client.get("/api/github/status").json()["login"] == "jane-renamed"
    assert client.delete("/api/github").status_code == 204
    assert client.get("/api/github/status").json()["connected"] is False
