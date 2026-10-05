import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, BookOpen, FileText, MessageSquare, TrendingUp } from "lucide-react";
import { NextAction } from "@/lib/readiness";

const ICONS: Record<NextAction["type"], React.ReactNode> = {
  assessment: <BookOpen className="h-5 w-5 text-primary" />,
  resume: <FileText className="h-5 w-5 text-primary" />,
  deep_interview: <MessageSquare className="h-5 w-5 text-primary" />,
  improve: <TrendingUp className="h-5 w-5 text-primary" />,
  prove: <BadgeCheck className="h-5 w-5 text-primary" />,
};

const NextActions: React.FC<{ actions: NextAction[] }> = ({ actions }) => {
  if (actions.length === 0) {
    return <p className="text-sm text-gray-600">Great work. Every requirement is measured and above 60. Keep practising to stay sharp.</p>;
  }
  return (
    <ul className="space-y-3">
      {actions.map((a, i) => (
        <li key={a.type}>
          <Link to={a.href} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-gray-50 hover:border-primary transition-colors">
            <span className="mt-0.5">{ICONS[a.type]}</span>
            <span className="flex-1">
              <span className="font-medium block">
                {i === 0 && <span className="text-xs text-primary font-semibold mr-2">NEXT</span>}
                {a.title}
              </span>
              <span className="text-sm text-gray-600">{a.description}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-gray-400 mt-1" />
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default NextActions;
