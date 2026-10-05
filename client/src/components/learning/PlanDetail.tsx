import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage } from "@/lib/api";
import { PlanView } from "@/lib/learning";
import { cn } from "@/lib/utils";

const PlanDetail: React.FC<{ planId: number; onChange: () => void; onDeleted: () => void }> = ({ planId, onChange, onDeleted }) => {
  const { toast } = useToast();
  const [plan, setPlan] = useState<PlanView | null>(null);

  useEffect(() => {
    setPlan(null);
    api
      .get<PlanView>(`/api/learning/plans/${planId}`)
      .then((r) => setPlan(r.data))
      .catch((err) => toast({ title: "Could not load the plan", description: apiErrorMessage(err), variant: "destructive" }));
  }, [planId, toast]);

  if (!plan) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const mark = async (body: { week?: number; resource?: string; done: boolean }) => {
    try {
      const { data } = await api.patch<PlanView>(`/api/learning/plans/${plan.id}/progress`, body);
      setPlan(data);
      onChange();
      if (data.status === "completed" && plan.status !== "completed")
        toast({ title: "Plan complete", description: "Take the re-test to measure how much you improved." });
    } catch (err) {
      toast({ title: "Could not save progress", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this learning plan?")) return;
    try {
      await api.delete(`/api/learning/plans/${plan.id}`);
      onDeleted();
    } catch (err) {
      toast({ title: "Could not delete", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  const { content, progress } = plan;
  const delta = plan.retestScore !== null ? plan.retestScore - plan.baselineScore : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {content.title}
            {plan.status === "completed" && <Badge className="bg-green-600">Complete</Badge>}
          </CardTitle>
          <CardDescription>{content.summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{plan.progressPct}% of weeks done</span>
              <span className="capitalize text-gray-500">
                {plan.skills.join(", ")} · {plan.difficulty}
              </span>
            </div>
            <Progress value={plan.progressPct} className="h-2" />
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-gray-50 p-3 text-sm">
            <span>
              Score before: <strong>{plan.baselineScore}%</strong>
            </span>
            {plan.retestScore !== null && (
              <>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <span>
                  after: <strong>{plan.retestScore}%</strong>
                </span>
                <Badge className={cn(delta! > 0 ? "bg-green-600" : delta! < 0 ? "bg-red-600" : "bg-gray-500")}>
                  {delta! > 0 ? "+" : ""}
                  {delta} points
                </Badge>
              </>
            )}
            <Button asChild size="sm" variant={plan.status === "completed" ? "default" : "outline"} className="ml-auto">
              <Link to={plan.retestHref}>
                <RotateCcw className="h-4 w-4 mr-1" /> {plan.retestScore !== null ? "Re-test again" : "Re-test"}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {content.weeklyPlan.map((w) => {
            const done = progress.weeks.includes(w.week);
            return (
              <label key={w.week} className={cn("flex gap-3 rounded-md border p-3 cursor-pointer", done && "bg-green-50 border-green-200")}>
                <Checkbox checked={done} onCheckedChange={(v) => mark({ week: w.week, done: v === true })} aria-label={`Week ${w.week} done`} />
                <div className="text-sm">
                  <p className={cn("font-medium", done && "line-through text-gray-500")}>
                    Week {w.week}: {w.goal}
                  </p>
                  <ul className="list-disc pl-5 text-gray-600">
                    {w.activities.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              </label>
            );
          })}
          {content.capstoneProject && (
            <p className="text-sm">
              <strong>Capstone project:</strong> {content.capstoneProject}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {content.learningPath.map((r) => {
            const done = progress.resources.includes(r.link);
            return (
              <div key={r.link} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                <Checkbox checked={done} onCheckedChange={(v) => mark({ resource: r.link, done: v === true })} aria-label={`Finished ${r.title}`} />
                <div className="flex-1 min-w-0">
                  <a href={r.link} target="_blank" rel="noopener noreferrer" className={cn("font-medium hover:underline inline-flex items-center gap-1", done && "line-through text-gray-500")}>
                    {r.title} <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="text-gray-600">
                    {r.provider} · {r.type} · ~{r.estimated_hours}h{r.free ? " · free" : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button variant="ghost" className="text-red-600" onClick={remove}>
        <Trash2 className="h-4 w-4 mr-1" /> Delete plan
      </Button>
    </div>
  );
};

export default PlanDetail;
