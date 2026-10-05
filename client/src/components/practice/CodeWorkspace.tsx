import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Play, RotateCcw, Sparkles, XCircle } from "lucide-react";
import CostNote from "@/components/CostNote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { invalidateReadiness } from "@/lib/readiness";
import { CompareMode, Language, loadPython, pythonLoaded, RunResult, runTests, TestCase } from "@/lib/codeRunner";
import { cn } from "@/lib/utils";

export const DIFFICULTY_STYLE: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-red-100 text-red-800",
};

interface CodeReview {
  summary: string;
  correctness_risks: string[];
  time_complexity: string;
  space_complexity: string;
  optimal_complexity: string;
  edge_cases_missed: string[];
  readability: string[];
  better_approach: string;
  improved_code: string;
  interview_tip: string;
  score: number;
}

interface Attempt {
  id: number;
  language: Language;
  code: string;
  passed: number;
  total: number;
  late: boolean;
  review: CodeReview | null;
}

interface Problem {
  slug: string;
  title: string;
  difficulty: string;
  topics: string[];
  statement: string;
  constraints: string[];
  examples: { args: unknown[]; expected: unknown }[];
  functionNames: Record<Language, string>;
  starterCode: Record<Language, string>;
  compare: CompareMode;
  tests: TestCase[];
  lastAttempt: Attempt | null;
}

const LANG_KEY = "skillsphere:code-language";
const draftKey = (slug: string, lang: Language) => `skillsphere:code:${slug}:${lang}`;
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: drafts are a convenience only */
  }
};
const show = (v: unknown) => JSON.stringify(v);

interface Props {
  slug: string;
  sessionId?: number;
  onAttempt?: (attempt: Attempt) => void;
}

const CodeWorkspace: React.FC<Props> = ({ slug, sessionId, onAttempt }) => {
  const { toast } = useToast();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [language, setLanguage] = useState<Language>((read(LANG_KEY) as Language) || "python");
  const [code, setCode] = useState("");
  const [run, setRun] = useState<RunResult | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState<"" | "loading-python" | "run" | "review">("");
  const escaped = useRef(false);

  useEffect(() => {
    setProblem(null);
    setRun(null);
    setAttempt(null);
    api
      .get<Problem>(`/api/coding/problems/${slug}`)
      .then((r) => setProblem(r.data))
      .catch((err) => toast({ title: "Could not load the problem", description: apiErrorMessage(err), variant: "destructive" }));
  }, [slug, toast]);

  // Restore a draft, else the last submitted code in this language, else the starter code.
  useEffect(() => {
    if (!problem) return;
    const last = problem.lastAttempt?.language === language ? problem.lastAttempt.code : null;
    setCode(read(draftKey(slug, language)) ?? last ?? problem.starterCode[language]);
    write(LANG_KEY, language);
  }, [problem, language, slug]);

  if (!problem) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const edit = (value: string) => {
    setCode(value);
    write(draftKey(slug, language), value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      escaped.current = true; // the next Tab leaves the editor, so keyboard users are never trapped
      return;
    }
    if (e.key === "Tab" && !escaped.current && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const indent = language === "python" ? "    " : "  ";
      const { selectionStart: start, selectionEnd: end } = el;
      const next = code.slice(0, start) + indent + code.slice(end);
      edit(next);
      requestAnimationFrame(() => el.setSelectionRange(start + indent.length, start + indent.length));
    }
    if (e.key !== "Escape") escaped.current = false;
  };

  const runAll = async () => {
    setRun(null); // never leave the previous run's result on screen while this one is pending
    setAttempt(null);
    try {
      if (language === "python" && !pythonLoaded()) {
        setBusy("loading-python");
        await loadPython();
      }
      setBusy("run");
      const result = await runTests(language, code, problem.functionNames[language], problem.tests, problem.compare);
      setRun(result);
      const passed = result.results.filter((r) => r.passed).length;
      const { data } = await api.post<Attempt>("/api/coding/attempts", {
        slug,
        language,
        code,
        passed,
        total: problem.tests.length,
        session_id: sessionId ?? null,
      });
      setAttempt(data);
      onAttempt?.(data);
      if (data.late) toast({ title: "Submitted after the deadline", description: "This run does not count towards the assessment." });
    } catch (err) {
      // Show the reason in the results panel, where it stays, not only in a passing toast.
      setRun({ results: [], logs: [], error: err instanceof Error ? err.message : apiErrorMessage(err) });
    } finally {
      setBusy("");
    }
  };

  const review = async () => {
    if (!attempt) return;
    setBusy("review");
    try {
      const { data } = await api.post<Attempt>(`/api/coding/attempts/${attempt.id}/review`);
      setAttempt(data);
      invalidateReadiness();
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not review your code", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const fn = problem.functionNames[language];
  const passed = run?.results.filter((r) => r.passed).length ?? 0;
  const visibleCount = problem.tests.filter((t) => !t.hidden).length;
  const rv = attempt?.review;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {problem.title}
            <Badge className={DIFFICULTY_STYLE[problem.difficulty]} variant="secondary">
              {problem.difficulty}
            </Badge>
          </CardTitle>
          <CardDescription>{problem.topics.join(" · ")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{problem.statement.replace(/`/g, "")}</p>
          {problem.examples.map((ex, i) => (
            <div key={i} className="rounded-md bg-gray-50 p-3 font-mono text-xs space-y-1 overflow-x-auto">
              <div>
                <span className="text-gray-500">Input:</span> {fn}({ex.args.map(show).join(", ")})
              </div>
              <div>
                <span className="text-gray-500">Output:</span> {show(ex.expected)}
              </div>
            </div>
          ))}
          <div>
            <h4 className="font-semibold mb-1">Constraints</h4>
            <ul className="list-disc pl-5 text-gray-700">
              {problem.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          {problem.compare !== "exact" && <p className="text-xs text-gray-500">The order of the returned items does not matter.</p>}
        </CardContent>
      </Card>

      <div className="space-y-4 min-w-0">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border p-0.5" role="group" aria-label="Language">
                {(["python", "javascript"] as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    aria-pressed={language === l}
                    className={cn("px-3 py-1 text-sm rounded", language === l ? "bg-primary text-primary-foreground" : "")}
                  >
                    {l === "python" ? "Python" : "JavaScript"}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm("Reset to the starter code? Your current code will be lost.")) edit(problem.starterCode[language]);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Reset
              </Button>
              <Button className="ml-auto" onClick={runAll} disabled={busy !== "" && busy !== "review"}>
                {busy === "run" || busy === "loading-python" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Run tests
              </Button>
            </div>
            <textarea
              aria-label="Code editor"
              value={code}
              onChange={(e) => edit(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full min-h-[320px] rounded-md border bg-gray-950 p-3 font-mono text-sm text-gray-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-gray-500">
              Code runs in your browser. Tab indents; press Esc then Tab to leave the editor.
              {busy === "loading-python" && " Loading Python for the first time (about 10 MB)…"}
            </p>
          </CardContent>
        </Card>

        {run && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {run.error ? (
                  <XCircle className="h-5 w-5 text-red-600" />
                ) : passed === problem.tests.length ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-600" />
                )}
                {run.error ? "Your code did not run" : `${passed} of ${problem.tests.length} tests passed`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {run.error && <pre className="whitespace-pre-wrap rounded bg-red-50 p-2 text-red-800 text-xs">{run.error}</pre>}
              {run.results.map((r, i) => {
                const t = problem.tests[i];
                const label = t.hidden ? `Hidden test ${i + 1 - visibleCount}` : `Test ${i + 1}`;
                return (
                  <div key={i} className={cn("rounded border p-2 text-xs", r.passed ? "border-green-200" : "border-red-200 bg-red-50/40")}>
                    <div className="flex items-center gap-2 font-medium">
                      {r.passed ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                      {label}
                    </div>
                    {!t.hidden && !r.passed && (
                      <div className="font-mono mt-1 space-y-0.5 overflow-x-auto">
                        <div>
                          Input: {fn}({t.args.map(show).join(", ")})
                        </div>
                        <div>Expected: {show(t.expected)}</div>
                        <div>{r.error ? `Error: ${r.error}` : `Got: ${show(r.output)}`}</div>
                      </div>
                    )}
                    {t.hidden && !r.passed && r.error && <div className="font-mono mt-1">Error: {r.error}</div>}
                  </div>
                );
              })}
              {run.logs.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-gray-600">Output ({run.logs.length} lines)</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs">{run.logs.join("\n")}</pre>
                </details>
              )}
              {attempt && !rv && (
                <div className="flex items-center gap-3 pt-2">
                  <Button variant="outline" onClick={review} disabled={busy === "review"}>
                    {busy === "review" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Get an interviewer's review
                  </Button>
                  <CostNote action="code_review" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {rv && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Interviewer review · {rv.score}/100
              </CardTitle>
              <CardDescription>{rv.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <strong>Complexity:</strong> {rv.time_complexity} time, {rv.space_complexity} space · best known: {rv.optimal_complexity}
              </p>
              {[
                ["Correctness risks", rv.correctness_risks],
                ["Edge cases to handle", rv.edge_cases_missed],
                ["Code quality", rv.readability],
              ].map(([title, items]) =>
                (items as string[]).length ? (
                  <div key={title as string}>
                    <h4 className="font-semibold">{title as string}</h4>
                    <ul className="list-disc pl-5">
                      {(items as string[]).map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
              {rv.better_approach && (
                <p>
                  <strong>Better approach:</strong> {rv.better_approach}
                </p>
              )}
              <details>
                <summary className="cursor-pointer font-semibold">Improved solution</summary>
                <pre className="mt-2 overflow-x-auto rounded bg-gray-950 p-3 text-xs text-gray-100">{rv.improved_code}</pre>
              </details>
              <p className="rounded bg-blue-50 p-2">
                <strong>Say this in the interview:</strong> {rv.interview_tip}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CodeWorkspace;
