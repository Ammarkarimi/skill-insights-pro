export interface PlanBrief {
  id: number;
  title: string;
  skills: string[];
  difficulty: string;
  baselineScore: number;
  retestScore: number | null;
  progressPct: number;
  nextWeek: number | null;
  status: "active" | "completed";
  createdAt: string;
}

export interface PlanView extends PlanBrief {
  content: {
    title: string;
    summary: string;
    focusAreas: { topic: string; why: string; priority: string }[];
    learningPath: { title: string; provider: string; link: string; type: string; estimated_hours: number; free: boolean; description: string }[];
    weeklyPlan: { week: number; goal: string; activities: string[] }[];
    capstoneProject: string;
  };
  progress: { weeks: number[]; resources: string[] };
  retestHref: string;
}

export interface LearningSummary {
  streak: number;
  practicedToday: boolean;
  last7: { date: string; count: number }[];
  weekGoal: { target: number; done: number };
  dueCards: number;
  totalCards: number;
  activePlans: PlanBrief[];
}

export interface ReviewCard {
  id: number;
  source: "assessment" | "proof" | "aptitude";
  skill: string;
  box: number;
  question: string;
  code: string | null;
  passage: string | null;
  options: Record<string, string>;
  topic: string | null;
}

export const SOURCE_LABEL: Record<ReviewCard["source"], string> = {
  assessment: "Skill assessment",
  proof: "Skill proof",
  aptitude: "Aptitude test",
};
