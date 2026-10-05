import React, { useEffect, useState } from "react";
import { BadgeCheck, ExternalLink, Github, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import CostNote from "@/components/CostNote";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { invalidateReadiness } from "@/lib/readiness";

export interface GithubStatus {
  enabled: boolean;
  connected: boolean;
  login: string | null;
  avatarUrl: string | null;
}

interface Review {
  id: number;
  repo: string;
  repoUrl: string;
  commitSha: string;
  commitUrl: string;
  ownership: { status: "owner" | "contributor" | "not_verified"; detail: string };
  meta: { filesReviewed: string[]; test_files: number; source_files: number; languages: Record<string, number> };
  overallScore: number;
  review: {
    project_type: string;
    summary: string;
    rubric: { dimension: string; score: number; evidence: string; improvement: string }[];
    skills: { skill: string; level: string; score: number; evidence: string }[];
    highlights: string[];
    improvements: string[];
    talking_points: string[];
  };
}

export const OwnershipBadge: React.FC<{ status: string }> = ({ status }) =>
  status === "owner" || status === "contributor" ? (
    <Badge className="bg-green-600 gap-1">
      <BadgeCheck className="h-3 w-3" /> {status === "owner" ? "Verified owner" : "Verified contributor"}
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-gray-600">
      <ShieldAlert className="h-3 w-3" /> Ownership not verified
    </Badge>
  );

const label = (d: string) => d.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const ProjectsTab: React.FC<{ github: GithubStatus | null; onGithubChange: () => void }> = ({ github, onGithubChange }) => {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [saved, setSaved] = useState<{ id: number; repo: string; overallScore: number; ownership: string }[]>([]);

  const load = () =>
    api
      .get<{ reviews: typeof saved }>("/api/projects")
      .then((r) => setSaved(r.data.reviews))
      .catch(() => undefined);
  useEffect(() => {
    load();
  }, []);

  const connect = async () => {
    try {
      const { data } = await api.get<{ url: string }>("/api/github/connect");
      window.location.href = data.url;
    } catch (err) {
      toast({ title: "Could not connect GitHub", description: apiErrorMessage(err), variant: "destructive" });
    }
  };
  const disconnect = async () => {
    await api.delete("/api/github").catch(() => undefined);
    onGithubChange();
  };

  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<Review>("/api/projects/review", { repo_url: url.trim() });
      setReview(data);
      setUrl("");
      invalidateReadiness();
      load();
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not review this repository", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: number) => {
    const { data } = await api.get<Review>(`/api/projects/${id}`);
    setReview(data);
  };
  const remove = async (id: number) => {
    if (!window.confirm("Delete this review?")) return;
    await api.delete(`/api/projects/${id}`);
    if (review?.id === id) setReview(null);
    load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" /> Review a GitHub project
            </CardTitle>
            <CardDescription>
              A staff-engineer review of a public repository: code quality, architecture, testing, docs, security and best
              practices, plus the skills your code proves.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {github?.enabled &&
              (github.connected ? (
                <div className="flex items-center justify-between rounded-md border bg-green-50 border-green-200 p-3 text-sm">
                  <span className="flex items-center gap-2">
                    {github.avatarUrl && <img src={github.avatarUrl} alt="" className="h-6 w-6 rounded-full" />}
                    Connected as <strong>@{github.login}</strong>. Repos you own or contributed to will be verified.
                  </span>
                  <Button variant="ghost" size="sm" onClick={disconnect}>
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <span>Connect GitHub so we can verify the projects are really yours. We only read your public profile.</span>
                  <Button variant="outline" onClick={connect}>
                    <Github className="mr-2 h-4 w-4" /> Connect GitHub
                  </Button>
                </div>
              ))}
            <Input value={url} placeholder="https://github.com/you/your-project" onChange={(e) => setUrl(e.target.value)} />
          </CardContent>
          <CardFooter className="flex justify-end items-center gap-3">
            <CostNote action="project_review" />
            <Button onClick={run} disabled={busy || url.trim().length < 3}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? "Reading the code..." : "Review project"}
            </Button>
          </CardFooter>
        </Card>

        {review && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <a href={review.repoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {review.repo}
                    </a>
                    <a href={review.commitUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-gray-500 hover:underline">
                      @{review.commitSha.slice(0, 7)}
                    </a>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <OwnershipBadge status={review.ownership.status} />
                    <Badge variant="secondary">{review.review.project_type}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{review.ownership.detail}</p>
                </div>
                <div className="text-center shrink-0">
                  <div className="text-4xl font-bold text-primary">{review.overallScore}</div>
                  <div className="text-xs text-gray-500">/ 100</div>
                </div>
              </div>
              <CardDescription className="text-base text-gray-700 pt-2">{review.review.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                {review.review.rubric.map((r) => (
                  <div key={r.dimension}>
                    <div className="flex justify-between text-sm font-medium">
                      <span>{label(r.dimension)}</span>
                      <span>{r.score}/10</span>
                    </div>
                    <Progress value={r.score * 10} className="h-1.5 my-1" />
                    <p className="text-xs text-gray-600">{r.evidence}</p>
                    <p className="text-xs text-amber-700">Improve: {r.improvement}</p>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold mb-2">Skills this code proves</h3>
                <div className="space-y-2">
                  {review.review.skills.map((s) => (
                    <div key={s.skill} className="text-sm">
                      <span className="font-medium">{s.skill}</span>{" "}
                      <Badge variant="outline" className="capitalize">
                        {s.level}
                      </Badge>{" "}
                      <span className="text-gray-500">{s.score}/100</span>
                      <p className="text-xs text-gray-600">{s.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {(
                  [
                    ["Highlights", review.review.highlights],
                    ["Top improvements", review.review.improvements],
                    ["Interview talking points", review.review.talking_points],
                  ] as const
                ).map(([title, list]) => (
                  <div key={title}>
                    <h4 className="font-semibold mb-1">{title}</h4>
                    <ul className="list-disc pl-5 space-y-1 text-gray-700">
                      {list.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">
                  Files reviewed ({review.meta.filesReviewed.length}) · {review.meta.source_files} source / {review.meta.test_files} test files in repo
                </summary>
                <ul className="mt-2 font-mono">
                  {review.meta.filesReviewed.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Reviewed projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {saved.length === 0 && <p className="text-sm text-gray-500">Your reviews appear here.</p>}
          {saved.map((s) => (
            <div key={s.id} className={`flex items-center justify-between rounded p-2 hover:bg-gray-50 ${review?.id === s.id ? "bg-primary/10" : ""}`}>
              <button onClick={() => open(s.id)} className="text-left text-sm min-w-0">
                <span className="font-medium truncate flex items-center gap-1">
                  {s.ownership !== "not_verified" && <BadgeCheck className="h-3 w-3 text-green-600 shrink-0" />}
                  {s.repo}
                </span>
                <span className="text-xs text-gray-500">{s.overallScore}/100</span>
              </button>
              <span className="flex">
                <a href={`https://github.com/${s.repo}`} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-400 hover:text-gray-700">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button onClick={() => remove(s.id)} className="p-1 text-gray-400 hover:text-red-600" aria-label="Delete review">
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectsTab;
