import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import CostNote from "@/components/CostNote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { invalidateReadiness } from "@/lib/readiness";
import { cn } from "@/lib/utils";

type Section = "quant" | "logical" | "verbal" | "mixed";
type Difficulty = "easy" | "medium" | "hard";

interface Question {
  id: number;
  section: "quant" | "logical" | "verbal";
  topic: string;
  question: string;
  passage: string | null;
  options: Record<string, string>;
}

interface ReviewItem extends Question {
  answer: string;
  explanation: string;
  userAnswer: string;
  correct: boolean;
}

interface Result {
  score: number;
  correct: number;
  total: number;
  answered: number;
  minutesUsed: number;
  perSection: Record<string, { name: string; correct: number; total: number; score: number }>;
  weakTopics: string[];
  review: ReviewItem[];
}

export interface AptitudeTest {
  id: number;
  section: Section;
  difficulty: Difficulty;
  status: "active" | "completed";
  total: number;
  deadlineAt: string;
  secondsLeft: number;
  questions?: Question[];
  answers?: Record<string, string>;
  result?: Result;
}

const SECTIONS: { value: Section; title: string; description: string }[] = [
  { value: "quant", title: "Quantitative", description: "Percentages, ratios, speed, work, interest, probability" },
  { value: "logical", title: "Logical reasoning", description: "Series, coding, clocks, syllogisms, arrangements" },
  { value: "verbal", title: "Verbal ability", description: "Reading comprehension, sentence correction, critical reasoning" },
  { value: "mixed", title: "Mixed (full mock)", description: "All three sections, like a real graduate screening test" },
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const AptitudeTab: React.FC<{ onFinished?: () => void }> = ({ onFinished }) => {
  const { toast } = useToast();
  const [section, setSection] = useState<Section>("mixed");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [test, setTest] = useState<AptitudeTest | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState<"" | "start" | "submit">("");
  const deadline = useRef(0);
  const autoSubmitted = useRef(false);

  // Resume an unfinished test after a reload.
  useEffect(() => {
    api
      .get<{ tests: { id: number; status: string }[] }>("/api/aptitude")
      .then(async (r) => {
        const active = r.data.tests.find((t) => t.status === "active");
        if (!active) return;
        const { data } = await api.get<AptitudeTest>(`/api/aptitude/${active.id}`);
        if (data.status === "active") {
          setTest(data);
          setAnswers(data.answers ?? {});
        }
      })
      .catch(() => undefined);
  }, []);

  const submit = useCallback(
    async (t: AptitudeTest) => {
      setBusy("submit");
      try {
        const { data } = await api.post<AptitudeTest>(`/api/aptitude/${t.id}/submit`);
        setTest(data);
        invalidateReadiness();
        onFinished?.();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        toast({ title: "Could not submit", description: apiErrorMessage(err), variant: "destructive" });
      } finally {
        setBusy("");
      }
    },
    [toast, onFinished],
  );

  // Countdown from the server deadline; submit automatically at zero.
  useEffect(() => {
    if (!test || test.status !== "active") return;
    deadline.current = Date.now() + test.secondsLeft * 1000;
    const tick = () => {
      const s = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        submit(test);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [test, submit]);

  const start = async () => {
    setBusy("start");
    try {
      const { data } = await api.post<AptitudeTest>("/api/aptitude/start", { section, difficulty });
      autoSubmitted.current = false;
      setTest(data);
      setAnswers(data.answers ?? {});
      setCurrent(0);
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not start the test", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const choose = (qid: number, letter: string) => {
    setAnswers((a) => ({ ...a, [qid]: letter }));
    api.post(`/api/aptitude/${test!.id}/answer`, { question_id: qid, answer: letter }).catch((err) => {
      toast({ title: "Answer not saved", description: apiErrorMessage(err), variant: "destructive" });
      if ((err as { response?: { status?: number } })?.response?.status === 409) submit(test!);
    });
  };

  if (test?.status === "completed" && test.result) {
    const r = test.result;
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              Your score: <span className="text-primary">{r.score}%</span>
              <Badge variant="secondary">
                {r.correct}/{r.total} correct
              </Badge>
            </CardTitle>
            <CardDescription>
              Answered {r.answered} of {r.total} in {r.minutesUsed} minutes.
              {r.weakTopics.length > 0 && <> Practise next: {r.weakTopics.join(", ")}.</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(r.perSection).map(([key, s]) => (
              <div key={key}>
                <div className="flex justify-between text-sm">
                  <span>{s.name}</span>
                  <span>
                    {s.correct}/{s.total} · {s.score}%
                  </span>
                </div>
                <Progress value={s.score} className="h-2" />
              </div>
            ))}
            <Button variant="outline" onClick={() => setTest(null)}>
              <RotateCcw className="h-4 w-4 mr-2" /> Take another test
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-3">
          <h3 className="font-semibold">Review</h3>
          {r.review.map((q, i) => (
            <Card key={q.id} className={q.correct ? "" : "border-red-200"}>
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  {q.correct ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">
                      {i + 1}. {q.topic}
                    </p>
                    {q.passage && <p className="rounded bg-gray-50 p-2 italic">{q.passage}</p>}
                    <p className="font-medium">{q.question}</p>
                    <p>
                      Correct: <strong>{q.answer}. {q.options[q.answer]}</strong>
                      {!q.correct && (
                        <span className="text-red-700"> · Yours: {q.userAnswer ? `${q.userAnswer}. ${q.options[q.userAnswer]}` : "not answered"}</span>
                      )}
                    </p>
                    <p className="text-gray-600">{q.explanation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (test?.status === "active" && test.questions) {
    const q = test.questions[current];
    const answered = Object.values(answers).filter(Boolean).length;
    return (
      <div className="space-y-4">
        <div className="sticky top-0 md:top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3">
          <span className={cn("flex items-center gap-2 font-mono text-lg", left < 120 && "text-red-600")} aria-live="polite">
            <Clock className="h-5 w-5" /> {fmt(left)}
          </span>
          <span className="text-sm text-gray-600">
            {answered}/{test.total} answered
          </span>
          <Button
            onClick={() => {
              if (answered < test.total && !window.confirm(`${test.total - answered} questions are unanswered. Submit anyway?`)) return;
              submit(test);
            }}
            disabled={busy === "submit"}
          >
            {busy === "submit" && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Submit test
          </Button>
        </div>
        <div className="flex flex-wrap gap-1" aria-label="Question navigator">
          {test.questions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setCurrent(i)}
              aria-label={`Question ${i + 1}${answers[qq.id] ? ", answered" : ""}`}
              className={cn(
                "h-8 w-8 rounded text-xs border",
                i === current ? "ring-2 ring-primary" : "",
                answers[qq.id] ? "bg-primary text-primary-foreground" : "bg-white",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardDescription>
              Question {current + 1} of {test.total} · {q.topic}
            </CardDescription>
            {q.passage && <p className="rounded bg-gray-50 p-3 text-sm leading-relaxed">{q.passage}</p>}
            <CardTitle className="text-lg leading-snug">{q.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={answers[q.id] ?? ""} onValueChange={(v) => choose(q.id, v)}>
              {Object.entries(q.options).map(([k, text]) => (
                <Label key={k} htmlFor={`apt-${q.id}-${k}`} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-gray-50 font-normal">
                  <RadioGroupItem id={`apt-${q.id}-${k}`} value={k} />
                  <span className="font-semibold">{k}.</span> {text}
                </Label>
              ))}
            </RadioGroup>
            <div className="flex justify-between">
              <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
                Previous
              </Button>
              <Button variant="outline" disabled={current === test.total - 1} onClick={() => setCurrent((c) => c + 1)}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const free = section === "quant";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aptitude test</CardTitle>
        <CardDescription>
          20 questions, 25 minutes, graded on our servers. Quantitative and series questions are computed, so their answers are always
          right; AI-written questions are checked by a second, independent solver before you see them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          {SECTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSection(s.value)}
              aria-pressed={section === s.value}
              className={cn("rounded-lg border p-4 text-left transition-colors", section === s.value ? "border-primary bg-primary/5" : "hover:bg-gray-50")}
            >
              <div className="font-medium flex items-center gap-2">
                {s.title} {s.value === "quant" && <Badge variant="secondary">Free</Badge>}
              </div>
              <div className="text-sm text-gray-600">{s.description}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Difficulty">
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
            <Button key={d} variant={difficulty === d ? "default" : "outline"} size="sm" onClick={() => setDifficulty(d)} className="capitalize">
              {d}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={start} disabled={busy === "start"}>
            {busy === "start" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Start test
          </Button>
          {!free && <CostNote action="aptitude_test" />}
        </div>
        {busy === "start" && !free && <p className="text-sm text-gray-500">Writing and double-checking your questions. This takes up to a minute.</p>}
      </CardContent>
    </Card>
  );
};

export default AptitudeTab;
