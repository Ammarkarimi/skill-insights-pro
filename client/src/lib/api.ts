import axios, { AxiosError } from "axios";

/**
 * Single HTTP client for the backend. In production the SPA is served by the API itself, so the
 * base URL is empty (same origin). Set VITE_API_URL only when hosting the frontend separately.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  withCredentials: true,
  timeout: 180_000, // LLM calls can take a while; the backend has its own timeouts.
});

export const CREDITS_EVENT = "skillsphere:credits";
export const INSUFFICIENT_EVENT = "skillsphere:insufficient-credits";
export const UNAUTHORIZED_EVENT = "skillsphere:unauthorized";

api.interceptors.response.use(
  (response) => {
    const remaining = response.headers["x-credits-remaining"];
    if (remaining !== undefined) {
      window.dispatchEvent(new CustomEvent(CREDITS_EVENT, { detail: Number(remaining) }));
    }
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 402) {
      window.dispatchEvent(new CustomEvent(INSUFFICIENT_EVENT, { detail: apiErrorMessage(error) }));
    } else if (status === 401 && !error.config?.url?.includes("/api/auth/")) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from any API error (FastAPI returns `{detail: string | {message}}`). */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") return "The request timed out. Please try again.";
    if (!error.response) return "Cannot reach the server. Check your connection and try again.";
    const detail = (error.response.data as { detail?: unknown })?.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      return String((detail as { message: unknown }).message);
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function isInsufficientCredits(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 402;
}

// ---------------------------------------------------------------- shared types
export interface User {
  id: number;
  email: string;
  name: string;
  credits: number;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  description: string;
  highlight: boolean;
}

export interface Pricing {
  currency: string;
  packs: CreditPack[];
  costs: Record<string, number>;
  freeSignupCredits: number;
  paymentsEnabled: boolean;
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100,
  );
}
