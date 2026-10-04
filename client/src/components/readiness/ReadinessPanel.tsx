import React, { useEffect, useState } from "react";
import { Loader2, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage } from "@/lib/api";
import { fetchReadiness, invalidateReadiness, Readiness, TargetRole } from "@/lib/readiness";
import ReadinessScore from "./ReadinessScore";
import RequirementList from "./RequirementList";
import ReadinessTrend from "./ReadinessTrend";
import NextActions from "./NextActions";
import TargetRoleWizard from "./TargetRoleWizard";

const ReadinessPanel: React.FC = () => {
  const { toast } = useToast();
  const [data, setData] = useState<Readiness | null>(null);
  const [targets, setTargets] = useState<TargetRole[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (force = false) => {
    try {
      const [r, t] = await Promise.all([fetchReadiness(force), api.get<{ targets: TargetRole[] }>("/api/readiness/targets")]);
      setData(r);
      setTargets(t.data.targets);
    } catch (err) {
      toast({ title: "Could not load your readiness", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTarget = async (id: string) => {
    setLoading(true);
    await api.post(`/api/readiness/targets/${id}/activate`).catch(() => undefined);
    invalidateReadiness();
    await load(true);
  };

  const wizard = <TargetRoleWizard open={wizardOpen} onOpenChange={setWizardOpen} onCreated={() => load(true)} />;

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.target) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-indigo-50 to-white">
        <CardContent className="py-10 flex flex-col md:flex-row items-center gap-8">
          <Target className="h-16 w-16 text-primary shrink-0" />
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold mb-2">How ready are you for your next job?</h2>
            <p className="text-gray-600">
              Tell us the role you are aiming for. We build a hiring scorecard from it, measure you against every
              requirement, and show you the fastest way to close the gaps.
            </p>
          </div>
          <Button size="lg" onClick={() => setWizardOpen(true)}>
            Set my target role
          </Button>
        </CardContent>
        {wizard}
      </Card>
    );
  }

  const { target } = data;
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Target role</p>
          <h2 className="text-2xl font-bold">{target.title}</h2>
          {target.summary && <p className="text-sm text-gray-600 max-w-2xl">{target.summary}</p>}
        </div>
        <div className="flex gap-2">
          {targets.length > 1 && (
            <Select value={String(target.id)} onValueChange={switchTarget}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New target
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6 space-y-6">
            <ReadinessScore score={data.score ?? 0} coverage={data.coverage ?? 0} />
            <ReadinessTrend trend={data.trend ?? []} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">What to do next</CardTitle>
            <CardDescription>The steps most likely to raise your score.</CardDescription>
          </CardHeader>
          <CardContent>
            <NextActions actions={data.actions ?? []} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Requirements scorecard</CardTitle>
          <CardDescription>
            Scores combine your assessments, interviews and resume, with recent results counting most. Unmeasured
            requirements count as zero until you prove them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequirementList requirements={data.requirements ?? []} sourceLabels={data.sourceLabels ?? {}} />
        </CardContent>
      </Card>
      {wizard}
    </div>
  );
};

export default ReadinessPanel;
