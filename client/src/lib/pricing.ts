export const ACTION_LABELS: Record<string, string> = {
  chat_message: "Career chatbot message",
  resume_skills: "Resume skill extraction",
  resume_analysis: "Full resume analysis",
  assessment_questions: "Skill assessment (10 questions)",
  learning_path: "Personalised learning path",
  interview_questions: "Mock interview questions",
  interview_evaluation: "Mock interview feedback report",
  job_match_per_resume: "Job match (per resume)",
  career_recommendations: "Career path recommendations",
  market_insights: "Job market report",
};

export const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || "Skill Sphere";
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "support@example.com";
