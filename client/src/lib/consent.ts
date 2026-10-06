/** The visitor's cookie choice (analytics, ads and attribution storage), kept in their browser. */
export type Consent = "granted" | "denied";

const KEY = "ss_cookie_consent";

export function storedConsent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: Consent): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* without storage the banner shows again next visit */
  }
}
