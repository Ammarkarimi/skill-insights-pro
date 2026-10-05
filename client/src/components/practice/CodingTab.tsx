import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, Loader2, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import CodeWorkspace, { DIFFICULTY_STYLE } from "./CodeWorkspace";

interface ProblemSummary {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topics: string[];
  solved: boolean;
  attempted: boolean;
}

interface OASession {
  id: number;
  level: "standard" | "hard";
  status: "active" | "completed";
  problems: { slug: string; title: string; difficulty: string }[];
  secondsLeft: number;
  result: { score: number; solved: number; problems: { slug: string; title: string; passed: number; total: number }[] } | null;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const CodingTab: React.FC<{ startInOA?: boolean; onFinished?: () => void }> = ({ startInOA, onFinished }) => {
  const { toast } = useToast();
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [filter, setFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [slug, setSlug] = useState<string | null>(null);
  const [oa, setOa] = useState<OASession | null>(null);
  const [oaSlug, setOaSlug] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const deadline = useRef(0);
  const finished = useRef(false);

  const loadProblems = () =>
    api
      .get<{ problems: ProblemSummary[] }>("/api/coding/problems")
      .then((r) => setProblems(r.data.problems))
      .catch(() => undefined);

  useEffect(() => {
    loadProblems();
    // Resume an unfinished mock assessment.
    api
      .get<{ sessions: { id: number; status: string }[] }>("/api/coding/oa")
      .then(async (r) => {
        const active = r.data.sessions.find((s) => s.status === "active");
        if (!active) return;
        const { data } = await api.get<OASession>(`/api/coding/oa/${active.id}`);
        if (data.status === "active") {
          setOa(data);
          setOaSlug(data.problems[0]?.slug ?? null);
        }
      })
      .catch(() => undefined);
  }, []);

  const finish = useCallback(
    async (session: OASession) => {
      setBusy(true);
      try {
        const { data } = await api.post<OASession>(`/api/coding/oa/${session.id}/finish`);
        setOa(data);
        loadProblems();
        onFinished?.();
      } catch (err) {
        toast({ title: "Could not finish the assessment", description: apiErrorMessage(err), variant: "destructive" });
      } finally {
        setBusy(false);
      }
    },
    [toast, onFinished],
  );

  useEffect(() => {
    if (!oa || oa.status !== "active") return;
    deadline.current = Date.now() + oa.secondsLeft * 1000;
    finished.current = false;
    const tick = () => {
      const s = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !finished.current) {
        finished.current = true;
        finish(oa);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [oa, finish]);

  const startOA = async (level: "standard" | "hard") => {
    setBusy(true);
    try {
      const { data } = await api.post<OASession>("/api/coding/oa/start", { level });
      setOa(data);
      setOaSlug(data.problems[0].slug);
      setSlug(null);
    } catch (err) {
      toast({ title: "Could not start the assessment", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------- mock OA
  if (oa?.status === "active" && oaSlug) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3">
          <span className={cn("flex items-center gap-2 font-mono text-lg", left < 300 && "text-red-600")} aria-live="polite">
            <Clock className="h-5 w-5" /> {fmt(left)}
          </span>
          <div className="flex gap-1" role="tablist" aria-label="Assessment problems">
            {oa.problems.map((p, i) => (
              <Button key={p.slug} role="tab" aria-selected={oaSlug === p.slug} size="sm" variant={oaSlug === p.slug ? "default" : "outline"} onClick={() => setOaSlug(p.slug)}>
                Problem {i + 1}
              </Button>
            ))}
          </div>
          <Button
            className="ml-auto"
            variant="outline"
            disabled={busy}
            onClick={() => window.confirm("Finish the assessment now? Your best run of each problem counts.") && finish(oa)}
          >
            Finish assessment
          </Button>
        </div>
        <CodeWorkspace key={oaSlug} slug={oaSlug} sessionId={oa.id} />
      </div>
    );
  }

  if (oa?.status === "completed" && oa.result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Mock assessment score: <span className="text-primary">{oa.result.score}%</span>
          </CardTitle>
          <CardDescription>
            You fully solved {oa.result.solved} of {oa.result.problems.length} problems. Real online assessments usually need both solved
            to move on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {oa.result.problems.map((p) => (
            <div key={p.slug} className="flex items-center justify-between rounded border p-3 text-sm">
              <span>{p.title}</span>
              <span className={p.passed === p.total ? "text-green-700 font-medium" : "text-amber-700"}>
                {p.passed}/{p.total} tests
              </span>
            </div>
          ))}
          <div className="flex gap-2">
            <Button onClick={() => setOa(null)}>Back to problems</Button>
            {oa.result.problems.map((p) => (
              <Button
                key={p.slug}
                variant="outline"
                onClick={() => {
                  setOa(null);
                  setSlug(p.slug);
                }}
              >
                Keep practising {p.title}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---------------------------------------------------------------- practice
  if (slug) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => (setSlug(null), loadProblems())}>
          <ArrowLeft className="h-4 w-4 mr-1" /> All problems
        </Button>
        <CodeWorkspace key={slug} slug={slug} onAttempt={() => loadProblems()} />
      </div>
    );
  }

  const shown = problems.filter((p) => filter === "all" || p.difficulty === filter);
  const solved = problems.filter((p) => p.solved).length;
  return (
    <div className="space-y-4">
      <Card className={cn(startInOA && "border-primary")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" /> Timed online assessment
          </CardTitle>
          <CardDescription>
            Two problems in 70 minutes, like a HackerRank or CodeSignal first round. Your best run of each problem counts. Free.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => startOA("standard")} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Start: easy + medium
          </Button>
          <Button variant="outline" onClick={() => startOA("hard")} disabled={busy}>
            Start: medium + hard
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          Practice problems <span className="text-sm font-normal text-gray-500">({solved}/{problems.length} solved)</span>
        </h3>
        <div className="flex gap-1" role="group" aria-label="Filter by difficulty">
          {(["all", "easy", "medium", "hard"] as const).map((d) => (
            <Button key={d} size="sm" variant={filter === d ? "default" : "outline"} onClick={() => setFilter(d)} className="capitalize">
              {d}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shown.map((p) => (
          <button key={p.slug} onClick={() => setSlug(p.slug)} className="rounded-lg border bg-white p-4 text-left hover:border-primary transition-colors">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{p.title}</span>
              {p.solved && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" aria-label="Solved" />}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="secondary" className={DIFFICULTY_STYLE[p.difficulty]}>
                {p.difficulty}
              </Badge>
              {p.topics.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CodingTab;
