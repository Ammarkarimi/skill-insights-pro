import React from "react";
import { Flame } from "lucide-react";
import { LearningSummary } from "@/lib/learning";
import { cn } from "@/lib/utils";

const dayLetter = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });

/** Streak count plus a seven-day row of practice days. */
const StreakStrip: React.FC<{ summary: LearningSummary; compact?: boolean }> = ({ summary, compact }) => (
  <div className="flex flex-wrap items-center gap-4">
    <div className="flex items-center gap-2">
      <Flame className={cn("h-7 w-7", summary.streak > 0 ? "text-orange-500" : "text-gray-300")} />
      <div>
        <div className="text-2xl font-bold leading-none">{summary.streak}</div>
        <div className="text-xs text-gray-500">day streak</div>
      </div>
    </div>
    <ol className="flex gap-1" aria-label="Practice in the last 7 days">
      {summary.last7.map((d) => (
        <li key={d.date} className="flex flex-col items-center gap-0.5">
          <span
            title={`${d.date}: ${d.count} practice${d.count === 1 ? "" : "s"}`}
            aria-label={`${d.date}: ${d.count ? "practised" : "no practice"}`}
            className={cn("h-6 w-6 rounded", d.count ? (d.count >= 5 ? "bg-green-600" : "bg-green-400") : "bg-gray-200")}
          />
          {!compact && <span className="text-[10px] text-gray-500">{dayLetter(d.date)}</span>}
        </li>
      ))}
    </ol>
    {!compact && (
      <div className="text-sm text-gray-600">
        This week: <strong>{summary.weekGoal.done}</strong>/{summary.weekGoal.target} practice days
      </div>
    )}
  </div>
);

export default StreakStrip;
