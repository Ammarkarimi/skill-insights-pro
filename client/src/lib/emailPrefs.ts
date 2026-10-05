export interface EmailPrefs {
  emailEnabled: boolean;
  decided: boolean;
  daily: boolean;
  weekly: boolean;
  timezone: string;
  sendHour: number;
}

export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** IANA zones the browser knows, with the user's own first. */
export function timeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }
  return Array.from(new Set([current, browserTimeZone(), "UTC", ...zones]));
}

export const hourLabel = (h: number) =>
  new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
