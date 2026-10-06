import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Public runtime settings from the server (GET /api/config). Keys change without a rebuild. */
export interface SiteConfig {
  appName: string;
  freeSignupCredits: number;
  requireEmailVerification: boolean;
  turnstileSiteKey: string;
}

let pending: Promise<SiteConfig | null> | null = null;

export function loadSiteConfig(): Promise<SiteConfig | null> {
  pending ??= api
    .get<SiteConfig>("/api/config")
    .then((r) => r.data)
    .catch(() => {
      pending = null; // try again next time
      return null;
    });
  return pending;
}

export function useSiteConfig(): SiteConfig | null {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  useEffect(() => {
    let live = true;
    loadSiteConfig().then((c) => live && setConfig(c));
    return () => {
      live = false;
    };
  }, []);
  return config;
}
