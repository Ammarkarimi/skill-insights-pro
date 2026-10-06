import { useState } from "react";
import { CreditPack, Pricing } from "@/lib/api";

/**
 * Which price list a visitor sees and pays in. With Paddle: USD, GBP, EUR or AUD (local prices);
 * with Stripe: the single configured currency ("default"); with Razorpay: INR. The guess comes from
 * the browser's time zone and language, and the visitor's choice is remembered.
 */
export type PayCurrency = "default" | "usd" | "gbp" | "eur" | "aud" | "inr";
export type PayProvider = "paddle" | "stripe" | "razorpay";
const KEY = "skillsphere:pay-currency";

const LABELS: Record<PayCurrency, string> = {
  default: "Card",
  usd: "USD $",
  gbp: "GBP £",
  eur: "EUR €",
  aud: "AUD A$",
  inr: "INR ₹ · UPI",
};

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

function languages(): readonly string[] {
  return typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
}

/** Visitors in India (time zone or browser language) see rupee prices first. */
export function looksIndian(): boolean {
  const tz = timeZone();
  return tz === "Asia/Kolkata" || tz === "Asia/Calcutta" || languages().some((l) => /-IN$/i.test(l));
}

const UK_ZONES = new Set(["Europe/London", "Europe/Belfast", "Europe/Guernsey", "Europe/Jersey", "Europe/Isle_of_Man"]);

/** Best guess at the visitor's currency. */
export function guessCurrency(): PayCurrency {
  if (looksIndian()) return "inr";
  const tz = timeZone();
  if (UK_ZONES.has(tz) || languages()[0]?.toLowerCase() === "en-gb") return "gbp";
  if (tz.startsWith("Australia/") || languages()[0]?.toLowerCase() === "en-au") return "aud";
  if (tz.startsWith("Europe/")) return "eur";
  return "usd";
}

function stored(): PayCurrency | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v in LABELS ? (v as PayCurrency) : null;
  } catch {
    return null;
  }
}

export interface PricedPack extends CreditPack {
  cents: number;
}

export function usePayCurrency(pricing: Pricing | null) {
  const [choice, setChoice] = useState<PayCurrency | null>(stored);
  const inrOn = !!pricing?.inr?.enabled;
  const provider = pricing?.cardProvider ?? null;
  const paddleCurrencies = (provider === "paddle" ? (pricing?.paddle?.currencies ?? []) : []) as PayCurrency[];

  const available: PayCurrency[] = [
    ...(provider === "paddle" ? paddleCurrencies : provider === "stripe" ? (["default"] as const) : []),
    ...(inrOn ? (["inr"] as const) : []),
  ];
  // Before anything is configured, show the default price list (for display only).
  const fallback: PayCurrency = available[0] ?? "default";
  const pick = (c: PayCurrency | null): PayCurrency | null => {
    if (!c) return null;
    if (available.includes(c)) return c;
    if (provider === "stripe" && c !== "inr" && available.includes("default")) return "default";
    return null;
  };
  const current = pick(choice) ?? pick(guessCurrency()) ?? fallback;

  const set = (c: PayCurrency) => {
    setChoice(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* preference is a convenience only */
    }
  };

  let packs: PricedPack[];
  let currency: string;
  if (current === "inr") {
    currency = "inr";
    packs = (pricing?.inr?.packs ?? []).map((p) => ({ ...p, cents: p.price_cents }));
  } else if (current === "default") {
    currency = pricing?.currency ?? "usd";
    packs = (pricing?.packs ?? []).map((p) => ({ ...p, cents: p.price_cents }));
  } else {
    currency = current;
    packs = (pricing?.packs ?? []).map((p) => ({ ...p, cents: p.prices?.[current] ?? p.price_cents }));
  }

  const payProvider: PayProvider | null = current === "inr" ? (inrOn ? "razorpay" : null) : provider;
  const taxIncluded = current === "inr" || (pricing?.paddle?.taxInclusive ?? []).includes(current);
  const taxNote =
    payProvider === "razorpay"
      ? "Prices include taxes. Payments by Razorpay."
      : payProvider === "paddle"
        ? `${taxIncluded ? `Prices include ${current === "aud" ? "GST" : "VAT"}.` : "Plus sales tax where applicable."} Secure checkout by Paddle.`
        : "";

  return {
    current,
    set,
    packs,
    currency,
    provider: payProvider,
    taxNote,
    options: available.map((value) => ({
      value,
      label: value === "default" ? `${(pricing?.currency ?? "usd").toUpperCase()} · card` : LABELS[value],
    })),
    showSwitch: available.length > 1,
    canBuy: payProvider !== null,
  };
}
