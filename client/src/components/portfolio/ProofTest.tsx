import React, { useCallback, useEffect, useRef, useState } from "react";
import { Award, Check, Clock, Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import CostNote from "@/components/CostNote";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { fetchReadiness, invalidateReadiness } from "@/lib/readiness";

interface Question {
  id: number;
  question: string;
  code: string | null;
  options: Record<string, string>;
  secondsLeft: number;
}
interface ReviewItem extends Omit<Question, "secondsLeft"> {
  answer: string;
  explanation: string;
  tier: string;
  userAnswer: string;
  correct: boolean;
  late: boolean;
}
export interface Proof {
  id: number;
  skill: string;
  status: "active" | "completed";
  questionNumber: number;
  total: number;
  secondsPerQuestion: number;
  question: Question | null;
  result?: {
    proficiency: number;
    level: string;
    correct: number;
    total: number;
    focusLost: number;
    perTier: Record<string, { answered: number; correct: number }>;
    review: ReviewItem[];
  };
}

export const LEVEL_STYLE: Record<string, string> = {
  Advanced: "bg-green-600",
  Intermediate: "bg-blue-600",
  Beginner: "bg-purple-600",
  Foundational: "bg-gray-500",
};

const ProofTest: React.FC<{ initialSkill?: string; onCompleted?: () => void }> = ({ initialSkill = "", onCompleted }) => {
  const { toast } = useToast();
  const [skill, setSkill] = useState(initialSkill);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [proof, setProof] = useState<Proof | null>(null);
  const [choice, setChoice] = useState("");
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const focusLost = useRef(0);
  const submitting = useRef(false);

  useEffect(() => {
    fetchReadiness()
      .then((r) => setSuggestions((r.target?.requirements ?? []).filter((q) => q.kind === "skill").map((q) => q.name).slice(0, 8)))
      .catch(() => undefined);
  }, []);

  // Count tab switches during an active test (shown on your result, not used for grading).
  useEffect(() => {
    if (proof?.status !== "active") return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") focusLost.current += 1;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [proof?.status]);

  const submit = useCallback(
    async (answer: string) => {
      if (!proof || submitting.current) return;
      submitting.current = true;
      setBusy(true);
      try {
        const { data } = await api.post<Proof>(`/api/proof/${proof.id}/answer`, { answer, focus_lost: focusLost.current });
        setProof(data);
        setChoice("");
        if (data.status === "completed") {
          invalidateReadiness();
          onCompleted?.();
        }
      } catch (err) {
        toast({ title: "Could not submit your answer", description: apiErrorMessage(err), variant: "destructive" });
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    },
    [proof, toast, onCompleted],
  );

  // Local countdown mirrors the server timer; at zero the (late) answer is submitted automatically.
  useEffect(() => {
    if (!proof?.question) return;
    setLeft(proof.question.secondsLeft);
    const started = Date.now();
    const initial = proof.question.secondsLeft;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, initial - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        submit("");
      }
    }, 250);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proof?.question?.id]);

  const start = async () => {
    setBusy(true);
    focusLost.current = 0;
    try {
      const { data } = await api.post<Proof>("/api/proof/start", { skill: skill.trim() });
      setProof(data);
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not start the proof", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!proof) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Prove a skill
          </CardTitle>
          <CardDescription>
            8 questions that get harder when you're right and easier when you're wrong, with 90 seconds each and no going back.
            You get a level you can show on your portfolio. One attempt per skill per day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="proof-skill">Skill</Label>
          <Input id="proof-skill" value={skill} maxLength={60} placeholder="e.g. React, PostgreSQL, Kubernetes" onChange={(e) => setSkill(e.target.value)} />
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-500 self-center">From your target role:</span>
              {suggestions.map((s) => (
                <button key={s} onClick={() => setSkill(s)} className="text-xs border rounded-full px-3 py-1 hover:bg-gray-50">
                  {s}
                </button>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end items-center gap-3">
          <CostNote action="proof_assessment" />
          <Button onClick={start} disabled={busy || !skill.trim()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start proof
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (proof.status === "completed" && proof.result) {
    const r = proof.result;
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6 flex flex-col sm:flex-row items-center gap-6">
            <Award className="h-16 w-16 text-amber-500 shrink-0" />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm text-gray-500">{proof.skill} proof</p>
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <Badge className={`${LEVEL_STYLE[r.level] ?? "bg-gray-500"} text-base px-3`}>{r.level}</Badge>
                <span className="text-3xl font-bold">{r.proficiency}</span>
                <span className="text-sm text-gray-500">proficiency</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {r.correct} of {r.total} correct. Harder questions count more.
                {r.focusLost > 0 && ` You left the tab ${r.focusLost} time${r.focusLost === 1 ? "" : "s"}.`}
              </p>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              {Object.entries(r.perTier).map(([tier, s]) => (
                <div key={tier} className="capitalize">
                  {tier}: {s.correct}/{s.answered}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {r.review.map((q, i) => (
              <div key={q.id} className={`border-l-4 pl-3 ${q.correct ? "border-green-500" : "border-red-500"}`}>
                <p className="text-xs text-gray-500 capitalize">
                  Q{i + 1} · {q.tier}
                  {q.late && " · time ran out"}
                </p>
                <p className="font-medium flex gap-2">
                  {q.correct ? <Check className="h-4 w-4 text-green-600 mt-1 shrink-0" /> : <X className="h-4 w-4 text-red-600 mt-1 shrink-0" />}
                  {q.question}
                </p>
                {!q.correct && (
                  <p className="text-sm text-red-700">Your answer: {q.userAnswer ? `${q.userAnswer}. ${q.options[q.userAnswer]}` : "none"}</p>
                )}
                <p className="text-sm text-green-700">
                  Correct: {q.answer}. {q.options[q.answer]}
                </p>
                <p className="text-sm text-gray-600">{q.explanation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Button variant="outline" onClick={() => setProof(null)}>
          Prove another skill
        </Button>
      </div>
    );
  }

  const q = proof.question;
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">
            {proof.skill} proof · Question {proof.questionNumber} of {proof.total}
          </CardTitle>
          <span className={`flex items-center gap-1 font-mono text-lg ${left <= 15 ? "text-red-600" : "text-gray-700"}`}>
            <Clock className="h-4 w-4" /> {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
        </div>
        <Progress value={(left / proof.secondsPerQuestion) * 100} className="h-1" />
      </CardHeader>
      {q && (
        <CardContent className="space-y-4">
          <p className="text-lg font-medium whitespace-pre-wrap">{q.question}</p>
          {q.code && (
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{q.code}</code>
            </pre>
          )}
          <RadioGroup value={choice} onValueChange={setChoice} className="space-y-2">
            {Object.entries(q.options).map(([key, value]) => (
              <label key={key} htmlFor={`p-${q.id}-${key}`} className="flex items-start gap-3 border rounded-md p-3 cursor-pointer hover:bg-gray-50">
                <RadioGroupItem id={`p-${q.id}-${key}`} value={key} className="mt-0.5" />
                <span>
                  <strong className="mr-2">{key}.</strong>
                  {value}
                </span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      )}
      <CardFooter className="justify-between">
        <span className="text-xs text-gray-500">Answers are final. There is no going back.</span>
        <Button onClick={() => submit(choice)} disabled={busy || !choice}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {proof.questionNumber === proof.total ? "Submit & finish" : "Submit answer"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProofTest;
