import { api } from "@/lib/api";

export interface Requirement {
  key: string;
  name: string;
  kind: "skill" | "experience" | "practice";
  weight: number;
  must_have: boolean;
  aliases?: string[];
}

export interface TargetRole {
  id: number;
  title: string;
  summary: string;
  jobDescription: string;
  requirements: Requirement[];
  isActive: boolean;
  createdAt: string;
}

export interface RequirementScore extends Omit<Requirement, "aliases"> {
  score: number | null;
  sources: Record<string, number>;
  evidenceCount: number;
  lastUpdated: string | null;
}

export interface NextAction {
  type: "assessment" | "resume" | "deep_interview" | "improve";
  title: string;
  description: string;
  href: string;
}

export interface Readiness {
  target: TargetRole | null;
  score?: number;
  coverage?: number;
  requirements?: RequirementScore[];
  trend?: { date: string; score: number }[];
  actions?: NextAction[];
  sourceLabels?: Record<string, string>;
}

// Small shared cache so the sidebar badge doesn't refetch on every page navigation.
let cached: { at: number; data: Readiness } | null = null;
const TTL_MS = 60_000;

export async function fetchReadiness(force = false): Promise<Readiness> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.data;
  const { data } = await api.get<Readiness>("/api/readiness");
  cached = { at: Date.now(), data };
  return data;
}

export function invalidateReadiness() {
  cached = null;
}

export const scoreColor = (s: number | null | undefined) =>
  s === null || s === undefined ? "text-gray-400" : s >= 75 ? "text-green-600" : s >= 50 ? "text-amber-500" : "text-red-500";

export const barColor = (s: number) => (s >= 75 ? "bg-green-500" : s >= 50 ? "bg-amber-500" : "bg-red-500");
