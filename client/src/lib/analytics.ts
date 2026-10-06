/**
 * Analytics and ad conversions (Google Analytics 4, Google Ads, Meta Pixel), loaded only after the
 * visitor accepts cookies ("basic" consent mode: no tags, no cookies, no pings before consent).
 * IDs come from the server (/api/config), so nothing loads unless they are configured.
 */
import { loadSiteConfig, SiteConfig } from "@/lib/site";
import { persistAttribution } from "@/lib/attribution";
import { Consent, saveConsent, storedConsent } from "@/lib/consent";

export { storedConsent };
type Analytics = NonNullable<SiteConfig["analytics"]>;

const TRACKED_KEY = "ss_tracked_purchases";
export const OPEN_SETTINGS_EVENT = "ss:cookie-settings";

type Fn = (...args: unknown[]) => void;
type Fbq = Fn & { queue: unknown[]; loaded: boolean; version: string; push?: Fn; callMethod?: Fn };
interface Win {
  dataLayer?: unknown[];
  gtag?: Fn;
  fbq?: Fbq;
  _fbq?: Fbq;
}
const w = window as unknown as Win;

let ids: Analytics | null = null;
let started = false;

export function hasTracking(a: SiteConfig["analytics"] | undefined): boolean {
  return !!a && !!(a.ga4 || a.googleAds || a.metaPixel);
}

/** Reopens the cookie banner (for "Cookie settings" links). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

function addScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function start(a: Analytics) {
  if (started) return;
  started = true;
  ids = a;
  const gtagId = a.ga4 || a.googleAds;
  if (gtagId) {
    const layer = (w.dataLayer = w.dataLayer || []);
    // gtag must push the `arguments` object itself, not an array.
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      layer.push(arguments);
    };
    w.gtag("consent", "default", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
    w.gtag("js", new Date());
    if (a.ga4) w.gtag("config", a.ga4, { send_page_view: false });
    if (a.googleAds) w.gtag("config", a.googleAds);
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagId)}`);
  }
  if (a.metaPixel) {
    // The standard Meta Pixel bootstrap: queue calls until fbevents.js arrives.
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    }) as Fbq;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    w.fbq = fbq;
    w._fbq = fbq;
    addScript("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", a.metaPixel);
  }
  trackPageView(window.location.pathname + window.location.search);
}

/** Start tracking if the visitor already accepted. Call once on load. */
export async function initAnalytics(): Promise<void> {
  if (storedConsent() !== "granted") return;
  const config = await loadSiteConfig();
  if (config?.analytics && hasTracking(config.analytics)) start(config.analytics);
}

export async function setConsent(choice: Consent): Promise<void> {
  saveConsent(choice);
  if (choice === "granted") {
    persistAttribution();
    const config = await loadSiteConfig();
    if (config?.analytics && hasTracking(config.analytics)) start(config.analytics);
  } else if (started) {
    // Tags already on the page cannot be unloaded; reload so nothing runs from now on.
    window.location.reload();
  }
}

export function trackPageView(path: string) {
  if (!started || !ids) return;
  if (ids.ga4) w.gtag?.("event", "page_view", { page_path: path, page_location: window.location.href });
  if (ids.metaPixel) w.fbq?.("track", "PageView");
}

export function trackSignUp() {
  if (!started || !ids) return;
  if (ids.ga4) w.gtag?.("event", "sign_up", { method: "email" });
  if (ids.googleAds && ids.googleAdsSignupLabel) {
    w.gtag?.("event", "conversion", { send_to: `${ids.googleAds}/${ids.googleAdsSignupLabel}` });
  }
  if (ids.metaPixel) w.fbq?.("track", "CompleteRegistration");
}

/** Purchase value is the pack price (before US sales tax); each payment is reported once per browser. */
export function trackPurchase(p: { amountCents?: number; currency?: string; ref?: string }) {
  if (!started || !ids || !p.ref || !p.amountCents || !p.currency) return;
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(TRACKED_KEY) || "[]");
    if (seen.includes(p.ref)) return;
    localStorage.setItem(TRACKED_KEY, JSON.stringify([...seen, p.ref].slice(-50)));
  } catch {
    /* report anyway */
  }
  const value = p.amountCents / 100;
  const currency = p.currency.toUpperCase();
  if (ids.ga4) w.gtag?.("event", "purchase", { transaction_id: p.ref, value, currency });
  if (ids.googleAds && ids.googleAdsPurchaseLabel) {
    w.gtag?.("event", "conversion", {
      send_to: `${ids.googleAds}/${ids.googleAdsPurchaseLabel}`,
      value,
      currency,
      transaction_id: p.ref,
    });
  }
  if (ids.metaPixel) w.fbq?.("track", "Purchase", { value, currency }, { eventID: p.ref });
}
