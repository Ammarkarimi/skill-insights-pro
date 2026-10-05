import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { LearningSummary } from "@/lib/learning";
import { PipelineStats } from "@/lib/applications";
import StreakStrip from "./StreakStrip";

const when = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Dashboard strip: streak, mistakes due for review, and the next application date. */
const TodayCard: React.FC = () => {
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [upcoming, setUpcoming] = useState<PipelineStats["upcoming"][number] | null>(null);

  useEffect(() => {
    api
      .get<LearningSummary>("/api/learning/summary")
      .then((r) => setSummary(r.data))
      .catch(() => undefined);
    api
      .get<{ stats: PipelineStats }>("/api/applications")
      .then((r) => setUpcoming(r.data.stats.upcoming[0] ?? null))
      .catch(() => undefined);
  }, []);

  if (!summary) return null;
  return (
    <Card className="mb-6">
      <CardContent className="py-4 grid gap-4 md:grid-cols-3 md:items-center">
        <StreakStrip summary={summary} compact />
        <div className="flex items-center gap-3">
          <Repeat className="h-5 w-5 text-primary shrink-0" />
          {summary.dueCards > 0 ? (
            <>
              <span className="text-sm">
                <strong>{summary.dueCards}</strong> mistake{summary.dueCards === 1 ? "" : "s"} to review
              </span>
              <Button asChild size="sm" className="ml-auto">
                <Link to="/learning">Review</Link>
              </Button>
            </>
          ) : (
            <span className="text-sm text-gray-600">{summary.practicedToday ? "Practised today. Nice." : "Nothing to review. Try a practice test."}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary shrink-0" />
          {upcoming ? (
            <Link to={`/applications?open=${upcoming.id}`} className="text-sm hover:underline">
              <strong>{when(upcoming.date)}</strong>: {upcoming.label || "Next step"} at {upcoming.company}
            </Link>
          ) : (
            <Link to="/applications" className="text-sm text-gray-600 hover:underline">
              No dates coming up. Track your applications.
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TodayCard;
