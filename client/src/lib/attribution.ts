/**
 * Marketing attribution: which ad or link brought this visitor. Sent once with signup, so purchases
 * can be traced back to campaigns. The first visit with a source (campaign tags, a click id or another
 * site as referrer) is kept for 90 days; it replaces an earlier direct visit, never another source.
 */
const KEY = "ss_attribution";
const MAX_AGE_MS = 90 * 86400_000;
const PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid",
] as const;

type Attribution = Record<string, string>;
interface Stored {
  data: Attribution;
  at: number;
}

function read(): Stored | null {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null") as Stored | null;
    return stored && Date.now() - stored.at < MAX_AGE_MS ? stored : null;
  } catch {
    return null;
  }
}

const hasSource = (a: Attribution) => Object.keys(a).some((k) => k !== "landing");

/** Call once on page load. */
export function captureAttribution(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const data: Attribution = {};
    for (const p of PARAMS) {
      const v = params.get(p);
      if (v) data[p] = v.slice(0, 200);
    }
    if (document.referrer && new URL(document.referrer).host !== window.location.host) {
      data.referrer = document.referrer.slice(0, 200);
    }
    data.landing = window.location.pathname.slice(0, 200);
    const existing = read();
    if (existing && (hasSource(existing.data) || !hasSource(data))) return;
    localStorage.setItem(KEY, JSON.stringify({ data, at: Date.now() } satisfies Stored));
  } catch {
    /* storage blocked: attribution is optional */
  }
}

export function getAttribution(): Attribution | undefined {
  return read()?.data;
}
