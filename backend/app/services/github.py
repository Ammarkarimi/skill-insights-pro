"""GitHub integration: OAuth identity linking (and, in project reviews, public repo access).

All HTTP goes through `http_client()` so tests can swap in an httpx.MockTransport.
"""

from __future__ import annotations

import base64
import re
import secrets
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import PurePosixPath
from urllib.parse import urlencode

import httpx
import jwt

from ..config import get_settings

API = "https://api.github.com"
OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize"
OAUTH_TOKEN = "https://github.com/login/oauth/access_token"
_STATE_PURPOSE = "github-connect"


class GithubError(Exception):
    """A GitHub request failed in a way we can explain to the user."""


def http_client() -> httpx.Client:
    settings = get_settings()
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
               "User-Agent": "SkillSphere"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    return httpx.Client(headers=headers, timeout=15.0, follow_redirects=True)


# ---------------------------------------------------------------- OAuth
def callback_url() -> str:
    return f"{get_settings().app_url.rstrip('/')}/api/github/callback"


def make_state(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "purpose": _STATE_PURPOSE, "nonce": secrets.token_urlsafe(12),
               "iat": now, "exp": now + timedelta(minutes=10)}
    return jwt.encode(payload, get_settings().jwt_secret, algorithm="HS256")


def state_is_valid(state: str, user_id: int) -> bool:
    try:
        payload = jwt.decode(state, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return False
    return payload.get("purpose") == _STATE_PURPOSE and payload.get("sub") == str(user_id)


def authorize_url(state: str) -> str:
    params = {"client_id": get_settings().github_client_id, "redirect_uri": callback_url(),
              "scope": "read:user", "state": state, "allow_signup": "false"}
    return f"{OAUTH_AUTHORIZE}?{urlencode(params)}"


def identity_from_code(code: str) -> dict:
    """Exchange an OAuth code for the user's GitHub identity. The token is discarded."""
    settings = get_settings()
    with http_client() as client:
        resp = client.post(OAUTH_TOKEN, headers={"Accept": "application/json"}, data={
            "client_id": settings.github_client_id, "client_secret": settings.github_client_secret,
            "code": code, "redirect_uri": callback_url()})
        token = resp.json().get("access_token") if resp.status_code == 200 else None
        if not token:
            raise GithubError("GitHub did not accept the sign-in. Please try again.")
        user = client.get(f"{API}/user", headers={"Authorization": f"Bearer {token}"})
        if user.status_code != 200:
            raise GithubError("Could not read your GitHub profile.")
        data = user.json()
    return {"id": int(data["id"]), "login": data["login"], "name": data.get("name") or "",
            "avatar_url": data.get("avatar_url") or ""}


# ---------------------------------------------------------------- public repositories
_REPO_RE = re.compile(r"^(?:https?://)?(?:www\.)?(?:github\.com/)?([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})"
                      r"(?:\.git)?(?:/.*)?$")

SKIP_DIRS = {"node_modules", "vendor", "dist", "build", ".git", "__pycache__", ".venv", "venv", "target",
             "out", "coverage", ".next", "site-packages", "third_party", "deps", "Pods", "bin", "obj",
             ".idea", ".vscode", "public", "static", "assets", "migrations"}
LOCK_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "Cargo.lock",
              "Gemfile.lock", "composer.lock", "go.sum", "Pipfile.lock", "bun.lockb"}
MANIFESTS = {"package.json", "requirements.txt", "pyproject.toml", "setup.py", "go.mod", "pom.xml",
             "build.gradle", "build.gradle.kts", "Cargo.toml", "Gemfile", "composer.json", "Pipfile"}
SOURCE_EXT = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".kt", ".go", ".rs", ".rb", ".php", ".cs",
              ".cpp", ".cc", ".c", ".h", ".swift", ".scala", ".vue", ".svelte", ".dart", ".ex", ".sql"}
PREFERRED_DIRS = ("src", "app", "lib", "pkg", "internal", "server", "api", "components", "services", "core")
MAX_FILE_BYTES = 40_000
MAX_FILE_CHARS = 12_000
TOTAL_CHAR_BUDGET = 80_000
MAX_SOURCE_FILES = 12


def parse_repo_url(url: str) -> tuple[str, str]:
    match = _REPO_RE.match(url.strip())
    if not match:
        raise GithubError("Enter a GitHub repository URL like https://github.com/owner/repo.")
    owner, repo = match.group(1), match.group(2)
    return owner, repo.removesuffix(".git")


def _skipped(path: str) -> bool:
    parts = PurePosixPath(path).parts
    return any(p in SKIP_DIRS or (p.startswith(".") and p != ".github") for p in parts[:-1])


def is_test_file(path: str) -> bool:
    p = path.lower()
    name = PurePosixPath(p).name
    return (any(seg in ("test", "tests", "spec", "__tests__") for seg in PurePosixPath(p).parts[:-1])
            or name.startswith("test_") or re.search(r"(_test|\.test|\.spec)\.[a-z]+$", name) is not None)


def select_files(tree: list[dict]) -> dict:
    """Choose a small, representative set of files to review. Pure function (no I/O)."""
    blobs = [t for t in tree if t.get("type") == "blob" and not _skipped(t["path"])]
    chosen: list[str] = []

    def take(path: str):
        if path not in chosen:
            chosen.append(path)

    readme = next((b["path"] for b in blobs if "/" not in b["path"]
                   and b["path"].lower().startswith("readme")), None)
    if readme:
        take(readme)
    for b in blobs:
        name = PurePosixPath(b["path"]).name
        depth = b["path"].count("/")
        if (name in MANIFESTS and depth <= 1) or (name == "Dockerfile" and depth <= 1):
            take(b["path"])
    for b in [b for b in blobs if b["path"].startswith(".github/workflows/")][:2]:
        take(b["path"])

    def eligible(b: dict) -> bool:
        name = PurePosixPath(b["path"]).name
        return (PurePosixPath(name).suffix.lower() in SOURCE_EXT and name not in LOCK_FILES
                and ".min." not in name and 0 < b.get("size", 0) <= MAX_FILE_BYTES)

    sources = [b for b in blobs if eligible(b) and not is_test_file(b["path"])]
    tests = [b for b in blobs if eligible(b) and is_test_file(b["path"])]

    def rank(b: dict):
        top = PurePosixPath(b["path"]).parts[0]
        size = b.get("size", 0)
        return (top not in PREFERRED_DIRS, b["path"].count("/") > 4, not 1_000 <= size <= 25_000, -size)

    per_dir: dict[str, int] = {}
    picked = 0
    for b in sorted(sources, key=rank):
        folder = str(PurePosixPath(b["path"]).parent)
        if per_dir.get(folder, 0) >= 3:
            continue  # spread the sample across the codebase
        per_dir[folder] = per_dir.get(folder, 0) + 1
        take(b["path"])
        picked += 1
        if picked >= MAX_SOURCE_FILES:
            break
    for b in sorted(tests, key=rank)[:2]:
        take(b["path"])

    return {
        "files": chosen,
        "test_files": len(tests),
        "source_files": len(sources),
        "tree": [b["path"] for b in blobs][:250],
    }


def _raise_for(resp: httpx.Response, what: str):
    if resp.status_code == 404:
        raise GithubError(f"{what} was not found. Only public repositories can be reviewed.")
    if resp.status_code in (403, 429):
        raise GithubError("GitHub is rate-limiting requests right now. Please try again in a few minutes.")
    if resp.status_code >= 400:
        raise GithubError(f"GitHub returned an error ({resp.status_code}).")


def fetch_snapshot(owner: str, repo: str) -> dict:
    """Read metadata and a bounded sample of files from a public repository."""
    with http_client() as client:
        meta = client.get(f"{API}/repos/{owner}/{repo}")
        _raise_for(meta, "That repository")
        m = meta.json()
        if m.get("private"):
            raise GithubError("Only public repositories can be reviewed.")
        full, branch = m["full_name"], m.get("default_branch") or "main"
        br = client.get(f"{API}/repos/{full}/branches/{branch}")
        _raise_for(br, "The default branch")
        sha = br.json()["commit"]["sha"]
        tree_resp = client.get(f"{API}/repos/{full}/git/trees/{sha}", params={"recursive": "1"})
        _raise_for(tree_resp, "The file tree")
        langs = client.get(f"{API}/repos/{full}/languages")
        languages = langs.json() if langs.status_code == 200 else {}
        contributors = client.get(f"{API}/repos/{full}/contributors", params={"per_page": 100})
        contribs = contributors.json() if contributors.status_code == 200 else []

        selection = select_files(tree_resp.json().get("tree", []))
        if selection["source_files"] == 0:
            raise GithubError("No reviewable source code was found in this repository.")

        def read(path: str) -> tuple[str, str]:
            resp = client.get(f"{API}/repos/{full}/contents/{path}", params={"ref": sha})
            if resp.status_code != 200:
                return path, ""
            data = resp.json()
            try:
                text = base64.b64decode(data.get("content", "")).decode("utf-8", errors="ignore")
            except ValueError:
                text = ""
            return path, text

        with ThreadPoolExecutor(max_workers=6) as pool:
            contents = list(pool.map(read, selection["files"]))

    files, used = [], 0
    for path, text in contents:
        text = text[:MAX_FILE_CHARS]
        if not text.strip() or used + len(text) > TOTAL_CHAR_BUDGET:
            continue
        used += len(text)
        files.append({"path": path, "content": text})

    return {
        "full_name": full,
        "html_url": m.get("html_url") or f"https://github.com/{full}",
        "description": m.get("description") or "",
        "owner_login": m["owner"]["login"],
        "default_branch": branch,
        "sha": sha,
        "stars": m.get("stargazers_count", 0),
        "forks": m.get("forks_count", 0),
        "fork": bool(m.get("fork")),
        "pushed_at": m.get("pushed_at"),
        "languages": languages,
        "test_files": selection["test_files"],
        "source_files": selection["source_files"],
        "tree": selection["tree"],
        "files": files,
        "contributors": [{"login": c.get("login"), "contributions": c.get("contributions", 0)}
                         for c in contribs if isinstance(c, dict)],
    }


def ownership(snapshot: dict, connected_login: str | None) -> dict:
    """How strongly we can tie this repository to the user."""
    if not connected_login:
        return {"status": "not_verified", "detail": "Connect GitHub to verify this is your work."}
    login = connected_login.lower()
    if snapshot["owner_login"].lower() == login and not snapshot["fork"]:
        return {"status": "owner", "detail": f"Repository owned by @{connected_login}."}
    total = sum(c["contributions"] for c in snapshot["contributors"]) or 0
    mine = next((c["contributions"] for c in snapshot["contributors"]
                 if (c["login"] or "").lower() == login), 0)
    if mine:
        share = round(100 * mine / total) if total else 0
        return {"status": "contributor", "commits": mine, "sharePct": share,
                "detail": f"@{connected_login} authored {mine} commits ({share}% of the history)."}
    return {"status": "not_verified",
            "detail": f"@{connected_login} does not own or appear among this repository's contributors."}
