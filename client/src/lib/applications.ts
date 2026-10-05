import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";

export type AppStatus = "saved" | "applied" | "assessment" | "interview" | "offer" | "rejected" | "withdrawn";

export const PIPELINE: { value: AppStatus; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "assessment", label: "Assessment" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
];
export const CLOSED: { value: AppStatus; label: string }[] = [
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];
export const STATUS_LABEL: Record<AppStatus, string> = Object.fromEntries(
  [...PIPELINE, ...CLOSED].map((s) => [s.value, s.label]),
) as Record<AppStatus, string>;

export interface ChecklistItem {
  key: string;
  label: string;
  stage: AppStatus;
  href: string | null;
  action: "make_target" | "prep_kit" | null;
  done: boolean;
}

export interface PrepKit {
  roleSummary: string;
  focusSkills: { skill: string; priority: "high" | "medium" | "low"; why: string; yourScore: number | null }[];
  likelyQuestions: { question: string; type: string; tip: string }[];
  questionsToAsk: string[];
  researchChecklist: string[];
  generatedAt: string;
}

export interface JobApplication {
  id: number;
  company: string;
  title: string;
  jobUrl: string;
  jobDescription: string;
  location: string;
  salaryNote: string;
  contact: string;
  notes: string;
  status: AppStatus;
  history: { status: AppStatus; at: string }[];
  nextDate: string | null;
  nextLabel: string;
  checklist: ChecklistItem[];
  prep: PrepKit | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStats {
  counts: Record<AppStatus, number>;
  applied: number;
  responseRate: number | null;
  interviews: number;
  offers: number;
  upcoming: { id: number; company: string; title: string; date: string; label: string }[];
}

/**
 * Pages opened from an application's checklist (`?application=<id>`) prefill the job details.
 * The callback runs once with the application.
 */
export function useApplicationPrefill(onLoad: (app: JobApplication, params: URLSearchParams) => void) {
  const [params] = useSearchParams();
  const id = params.get("application");
  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) return;
    api
      .get<JobApplication>(`/api/applications/${id}`)
      .then((r) => onLoad(r.data, params))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}

/** Mark a checklist step done when the user completes it from a prefilled page. */
export function markStepDone(params: URLSearchParams, key: string) {
  const id = params.get("application");
  if (!id || !/^\d+$/.test(id)) return;
  api.patch(`/api/applications/${id}`, { checklist: { [key]: true } }).catch(() => undefined);
}
