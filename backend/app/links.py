"""Verify LLM-suggested resource links and replace dead/hallucinated ones with search links.

LLMs regularly invent plausible-looking URLs. Rather than silently dropping resources (the old
behaviour), any link that does not resolve is swapped for a search URL that always works.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote_plus, urlparse

import httpx

log = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SkillSphereLinkCheck/1.0; +https://skillsphere.app)",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
}
# Sites that block bots (403/429) are still real pages; only clear "not found" signals fail.
_DEAD_STATUSES = {404, 410}


def _search_url(title: str, provider: str = "", kind: str = "") -> str:
    query = " ".join(p for p in (title, provider) if p).strip()
    if kind.lower() in {"video", "youtube"}:
        return f"https://www.youtube.com/results?search_query={quote_plus(query)}"
    return f"https://www.google.com/search?q={quote_plus(query)}"


def _is_http_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc) and "example" not in parsed.netloc


def url_is_alive(url: str, client: httpx.Client) -> bool:
    if not _is_http_url(url):
        return False
    try:
        resp = client.head(url)
        if resp.status_code in {405, 501} or resp.status_code >= 500:
            resp = client.get(url)
        return resp.status_code not in _DEAD_STATUSES and resp.status_code < 500
    except httpx.HTTPError:
        return False


def verify_links(items: list[dict], url_key: str = "link", title_key: str = "title",
                 provider_key: str = "provider", type_key: str = "type") -> list[dict]:
    """Mutates and returns `items`, adding `link_verified` and fixing dead links."""
    if not items:
        return items
    with httpx.Client(timeout=6.0, follow_redirects=True, headers=_HEADERS) as client, \
            ThreadPoolExecutor(max_workers=8) as pool:
        alive = list(pool.map(lambda it: url_is_alive(it.get(url_key, ""), client), items))
    for item, ok in zip(items, alive, strict=False):
        item["link_verified"] = ok
        if not ok:
            item[url_key] = _search_url(item.get(title_key, ""), item.get(provider_key, ""),
                                        item.get(type_key, ""))
    return items
