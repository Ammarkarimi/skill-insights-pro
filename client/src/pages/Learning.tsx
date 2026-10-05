import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import DailyReview from "@/components/learning/DailyReview";
import PlanDetail from "@/components/learning/PlanDetail";
import StreakStrip from "@/components/learning/StreakStrip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { LearningSummary, PlanBrief } from "@/lib/learning";
import { cn } from "@/lib/utils";

const Learning: React.FC = () => {
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [plans, setPlans] = useState<PlanBrief[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const loadSummary = useCallback(
    () =>
      api
        .get<LearningSummary>("/api/learning/summary")
        .then((r) => setSummary(r.data))
        .catch(() => undefined),
    [],
  );
  const loadPlans = useCallback(
    () =>
      api
        .get<{ plans: PlanBrief[] }>("/api/learning/plans")
        .then((r) => {
          setPlans(r.data.plans);
          setSelected((cur) => cur ?? r.data.plans.find((p) => p.status === "active")?.id ?? r.data.plans[0]?.id ?? null);
        })
        .catch(() => setPlans([])),
    [],
  );

  useEffect(() => {
    loadSummary();
    loadPlans();
  }, [loadSummary, loadPlans]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="page-header mb-1">Learning</h1>
          <p className="text-gray-600">A few minutes a day: review your mistakes, work through your plan, then re-test to prove the gain.</p>
        </div>

        {summary && (
          <Card>
            <CardContent className="py-4">
              <StreakStrip summary={summary} />
            </CardContent>
          </Card>
        )}

        {summary && <DailyReview dueCount={summary.dueCards} totalCards={summary.totalCards} onProgress={loadSummary} />}

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Learning plans</h2>
          {plans === null ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : plans.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <BookOpen className="h-8 w-8 mx-auto text-gray-400" />
                <p className="text-gray-600">Take a skill assessment and generate a learning path. It is saved here so you can track it.</p>
                <Button asChild>
                  <Link to="/skill-assessment">Take an assessment</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-[280px_1fr] gap-6">
              <nav aria-label="Your learning plans" className="space-y-2">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    aria-current={p.id === selected}
                    className={cn("w-full rounded-lg border bg-white p-3 text-left", p.id === selected ? "border-primary ring-1 ring-primary" : "hover:bg-gray-50")}
                  >
                    <div className="font-medium text-sm">{p.title}</div>
                    <Progress value={p.progressPct} className="h-1.5 my-2" />
                    <div className="text-xs text-gray-500">
                      {p.status === "completed" ? "Complete" : p.nextWeek ? `Next: week ${p.nextWeek}` : ""}
                      {p.retestScore !== null && ` · ${p.baselineScore}% → ${p.retestScore}%`}
                    </div>
                  </button>
                ))}
              </nav>
              <div className="min-w-0">
                {selected && (
                  <PlanDetail
                    key={selected}
                    planId={selected}
                    onChange={() => {
                      loadPlans();
                      loadSummary();
                    }}
                    onDeleted={() => {
                      setSelected(null);
                      loadPlans();
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default Learning;
