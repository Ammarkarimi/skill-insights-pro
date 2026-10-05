import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Award, ExternalLink, Github, Loader2, ShieldCheck, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { OwnershipBadge } from "@/components/portfolio/ProjectsTab";
import { LEVEL_STYLE } from "@/components/portfolio/ProofTest";

interface PublicData {
  displayName: string;
  headline: string;
  bio: string;
  github: { login: string; url: string; avatarUrl: string } | null;
  readiness: { role: string; score: number; coverage: number } | null;
  proofs: { skill: string; level: string; proficiency: number; completedAt: string; attempts: number }[];
  projects: {
    repo: string;
    repoUrl: string;
    commitUrl: string;
    commitSha: string;
    ownership: { status: string; detail: string };
    overallScore: number;
    projectType: string;
    summary: string;
    highlights: string[];
    rubric: { dimension: string; score: number }[];
    skills: { skill: string; level: string; score: number }[];
    languages: string[];
    reviewedAt: string;
  }[];
  updatedAt: string;
}

const dimLabel = (d: string) => d.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const PublicPortfolio: React.FC = () => {
  const { slug = "" } = useParams();
  const [data, setData] = useState<PublicData | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api
      .get<PublicData>(`/api/public/portfolio/${encodeURIComponent(slug)}`)
      .then((r) => {
        setData(r.data);
        document.title = `${r.data.displayName || "Portfolio"}: verified skills | SkillSphere`;
      })
      .catch(() => setMissing(true));
  }, [slug]);

  if (missing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
        <h1 className="text-2xl font-bold">This portfolio is not available</h1>
        <p className="text-gray-600">It may have been unpublished or the link is mistyped.</p>
        <Button asChild>
          <Link to="/">Go to Skill Sphere</Link>
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/" className="font-bold text-primary">
            Skill Sphere
          </Link>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-green-600" /> Verified skill portfolio
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <section className="flex flex-col sm:flex-row gap-6 items-start">
          {data.github?.avatarUrl && <img src={data.github.avatarUrl} alt="" className="h-20 w-20 rounded-full border" />}
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{data.displayName || "Portfolio"}</h1>
            {data.headline && <p className="text-lg text-gray-700">{data.headline}</p>}
            {data.bio && <p className="text-gray-600 mt-2 whitespace-pre-wrap">{data.bio}</p>}
            {data.github && (
              <a href={data.github.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm mt-2 hover:underline">
                <Github className="h-4 w-4" /> @{data.github.login}
              </a>
            )}
          </div>
          {data.readiness && (
            <Card className="w-full sm:w-56">
              <CardContent className="pt-6 text-center">
                <Target className="h-6 w-6 mx-auto text-primary" />
                <div className="text-3xl font-bold mt-1">{data.readiness.score}</div>
                <div className="text-xs text-gray-600">readiness for {data.readiness.role}</div>
              </CardContent>
            </Card>
          )}
        </section>

        {data.proofs.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-1">Proven skills</h2>
            <p className="text-sm text-gray-500 mb-4">Timed, adaptive, server-graded tests. Difficulty rises with each correct answer.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.proofs.map((p) => (
                <Card key={p.skill}>
                  <CardContent className="pt-6 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-500" /> {p.skill}
                      </span>
                      <Badge className={LEVEL_STYLE[p.level] ?? "bg-gray-500"}>{p.level}</Badge>
                    </div>
                    <Progress value={p.proficiency} className="h-2" />
                    <p className="text-xs text-gray-500">
                      Proficiency {p.proficiency}/100 · {date(p.completedAt)} · {p.attempts} attempt{p.attempts === 1 ? "" : "s"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {data.projects.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-1">Reviewed projects</h2>
            <p className="text-sm text-gray-500 mb-4">AI code reviews against a hiring rubric, pinned to the exact commit reviewed.</p>
            <div className="space-y-4">
              {data.projects.map((p) => (
                <Card key={p.repo}>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between gap-3">
                      <div>
                        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                          <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                            {p.repo} <ExternalLink className="h-4 w-4" />
                          </a>
                          <a href={p.commitUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-gray-500 hover:underline">
                            @{p.commitSha}
                          </a>
                        </CardTitle>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <OwnershipBadge status={p.ownership.status} />
                          <Badge variant="secondary">{p.projectType}</Badge>
                          {p.languages.map((l) => (
                            <Badge key={l} variant="outline">
                              {l}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-center shrink-0">
                        <div className="text-3xl font-bold text-primary">{p.overallScore}</div>
                        <div className="text-xs text-gray-500">review score</div>
                      </div>
                    </div>
                    <CardDescription className="text-gray-700 pt-2">{p.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      {p.rubric.map((r) => (
                        <div key={r.dimension} className="text-sm">
                          <div className="flex justify-between">
                            <span>{dimLabel(r.dimension)}</span>
                            <span>{r.score}/10</span>
                          </div>
                          <Progress value={r.score * 10} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {p.skills.map((s) => (
                          <Badge key={s.skill} variant="secondary" className="capitalize">
                            {s.skill} · {s.level}
                          </Badge>
                        ))}
                      </div>
                      <ul className="list-disc pl-5 text-gray-700 space-y-1">
                        {p.highlights.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-gray-500">{p.ownership.detail} Reviewed {date(p.reviewedAt)}.</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {data.proofs.length === 0 && data.projects.length === 0 && (
          <p className="text-gray-500 text-center py-12">Nothing has been added to this portfolio yet.</p>
        )}

        <section className="rounded-xl border bg-white p-6 text-sm text-gray-600 space-y-2">
          <h3 className="font-semibold text-gray-900">How Skill Sphere verifies skills</h3>
          <p>
            <strong>Skill proofs</strong> are 8-question adaptive tests with a 90-second limit per question. Answers are graded on
            our servers and the answer key is never shown during the test. Retakes are limited to one per day.
          </p>
          <p>
            <strong>Project reviews</strong> read the public code at a specific commit. "Verified" means the owner signed in with
            GitHub and owns or contributed to the repository.
          </p>
          <p className="text-xs">These are independent assessments, not formal certifications. Updated {date(data.updatedAt)}.</p>
          <Button asChild size="sm" className="mt-2">
            <Link to="/register">Prove your own skills</Link>
          </Button>
        </section>
      </main>
    </div>
  );
};

export default PublicPortfolio;
