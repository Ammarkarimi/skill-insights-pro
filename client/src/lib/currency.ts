import { useState } from "react";
import { CreditPack, Pricing } from "@/lib/api";

export type PayCurrency = "default" | "inr";
const KEY = "skillsphere:pay-currency";

/** Visitors in India (time zone or browser language) see rupee prices first. */
export function looksIndian(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return true;
  } catch {
    /* ignore */
  }
  return typeof navigator !== "undefined" && (navigator.languages ?? [navigator.language]).some((l) => /-IN$/i.test(l));
}

function stored(): PayCurrency | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "inr" || v === "default" ? v : null;
  } catch {
    return null;
  }
}

/** Which price list to show: the default (Stripe) one or rupees (Razorpay), remembered per browser. */
export function usePayCurrency(pricing: Pricing | null) {
  const [choice, setChoice] = useState<PayCurrency | null>(stored);
  const inrOn = !!pricing?.inr?.enabled;
  const defaultOn = !!pricing?.paymentsEnabled;
  let current: PayCurrency = choice ?? (looksIndian() ? "inr" : "default");
  if (current === "inr" && !inrOn) current = "default";
  if (current === "default" && !defaultOn && inrOn) current = "inr";
  const set = (c: PayCurrency) => {
    setChoice(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* preference is a convenience only */
    }
  };
  const packs: CreditPack[] = current === "inr" ? (pricing?.inr?.packs ?? []) : (pricing?.packs ?? []);
  const currency = current === "inr" ? "inr" : (pricing?.currency ?? "usd");
  return { current, set, packs, currency, showSwitch: inrOn && defaultOn, inrOn, defaultOn };
}
