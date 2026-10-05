import React, { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Play, RotateCcw, Sparkles } from "lucide-react";
import CostNote from "@/components/CostNote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { invalidateReadiness } from "@/lib/readiness";
import { getRecognition, isSpeechSupported, SpeechRecognitionLike } from "@/lib/speech";
import { cn } from "@/lib/utils";
import type { StoryItem } from "./StoryEditor";

interface DrillQuestion {
  id: number;
  text: string;
  themes: string[];
  suggestedStoryId: number | null;
}

interface DrillResult {
  answers: {
    question: string;
    storyTitle: string | null;
    answer: string;
    score: number;
    structure: string;
    relevance: string;
    impact: string;
    better_answer_outline: string;
  }[];
  overall: { score: number; summary: string; focus_next: string[] };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const DrillTab: React.FC<{ stories: StoryItem[]; themes: Record<string, string> }> = ({ stories, themes }) => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<DrillQuestion[] | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { storyId: number | null; text: string }>>({});
  const [result, setResult] = useState<DrillResult | null>(null);
  const [busy, setBusy] = useState<"" | "load" | "submit">("");
  const [listening, setListening] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");

  // Per-question stopwatch: real answers should land around two minutes.
  useEffect(() => {
    if (!questions || result) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [step, questions, result]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const begin = async () => {
    setBusy("load");
    try {
      const { data } = await api.get<{ questions: DrillQuestion[] }>("/api/stories/drill/questions");
      setQuestions(data.questions);
      setAnswers(Object.fromEntries(data.questions.map((q) => [q.id, { storyId: q.suggestedStoryId, text: "" }])));
      setStep(0);
      setResult(null);
    } catch (err) {
      toast({ title: "Could not start the drill", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const listen = (qid: number) => {
    const recognition = getRecognition();
    if (!recognition) return;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    baseRef.current = answers[qid].text ? answers[qid].text.trimEnd() + " " : "";
    recognition.onresult = (event) => {
      const text = baseRef.current + Array.from(event.results).map((r) => r[0].transcript).join("");
      setAnswers((a) => ({ ...a, [qid]: { ...a[qid], text } }));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = (e) => {
      setListening(false);
      if (e.error !== "aborted" && e.error !== "no-speech")
        toast({ title: "Microphone error", description: `${e.error}. You can type instead.`, variant: "destructive" });
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const submit = async () => {
    stopListening();
    setBusy("submit");
    try {
      const { data } = await api.post<DrillResult>("/api/stories/drill", {
        answers: questions!.map((q) => ({ question_id: q.id, story_id: answers[q.id].storyId, answer: answers[q.id].text })),
      });
      setResult(data);
      invalidateReadiness();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not evaluate the drill", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              Drill score: <span className="text-primary">{result.overall.score}/100</span>
            </CardTitle>
            <CardDescription>{result.overall.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm">Practise next</h4>
              <ul className="list-disc pl-5 text-sm">
                {result.overall.focus_next.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <Button variant="outline" onClick={begin}>
              <RotateCcw className="h-4 w-4 mr-2" /> New drill
            </Button>
          </CardContent>
        </Card>
        {result.answers.map((a, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardDescription>
                Question {i + 1}
                {a.storyTitle && <> · story: {a.storyTitle}</>}
              </CardDescription>
              <CardTitle className="text-base flex justify-between gap-3">
                <span>{a.question}</span>
                <Badge variant="secondary" className={cn(a.score >= 7 ? "bg-green-100 text-green-800" : a.score >= 4 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800")}>
                  {a.score}/10
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {a.answer ? <p className="text-gray-600 italic">"{a.answer}"</p> : <p className="text-gray-500">Not answered.</p>}
              <p>
                <strong>Structure:</strong> {a.structure}
              </p>
              {a.relevance && (
                <p>
                  <strong>Relevance:</strong> {a.relevance}
                </p>
              )}
              {a.impact && (
                <p>
                  <strong>Impact:</strong> {a.impact}
                </p>
              )}
              {a.better_answer_outline && <pre className="whitespace-pre-wrap rounded bg-gray-50 p-2 font-sans">{a.better_answer_outline}</pre>}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (questions) {
    const q = questions[step];
    const current = answers[q.id];
    const story = stories.find((s) => s.id === current.storyId);
    const last = step === questions.length - 1;
    return (
      <div className="space-y-4">
        <Progress value={((step + 1) / questions.length) * 100} className="h-2" />
        <Card>
          <CardHeader>
            <CardDescription className="flex flex-wrap items-center gap-2">
              Question {step + 1} of {questions.length}
              {q.themes.map((t) => (
                <Badge key={t} variant="outline">
                  {themes[t] ?? t}
                </Badge>
              ))}
              <span className={cn("ml-auto font-mono", elapsed > 150 && "text-amber-700")}>{fmt(elapsed)}</span>
            </CardDescription>
            <CardTitle className="text-xl leading-snug">{q.text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="drill-story">Story to use</Label>
              <select
                id="drill-story"
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                value={current.storyId ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: { ...current, storyId: e.target.value ? Number(e.target.value) : null } })}
              >
                <option value="">No story / answer freely</option>
                {stories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                    {s.id === q.suggestedStoryId ? " (suggested)" : ""}
                  </option>
                ))}
              </select>
              {story && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600">Peek at your notes</summary>
                  <div className="mt-1 rounded bg-gray-50 p-2 space-y-1">
                    <p>
                      <strong>S:</strong> {story.situation}
                    </p>
                    <p>
                      <strong>T:</strong> {story.task}
                    </p>
                    <p>
                      <strong>A:</strong> {story.action}
                    </p>
                    <p>
                      <strong>R:</strong> {story.result}
                    </p>
                  </div>
                </details>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="drill-answer">Your answer (say it out loud, or type it)</Label>
              <Textarea
                id="drill-answer"
                rows={6}
                maxLength={4000}
                value={current.text}
                onChange={(e) => setAnswers({ ...answers, [q.id]: { ...current, text: e.target.value } })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isSpeechSupported() && (
                <Button variant="outline" onClick={() => (listening ? stopListening() : listen(q.id))}>
                  {listening ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                  {listening ? "Stop" : "Speak"}
                </Button>
              )}
              <Button variant="outline" disabled={step === 0} onClick={() => (stopListening(), setStep((s) => s - 1))}>
                Previous
              </Button>
              {last ? (
                <>
                  <Button onClick={submit} disabled={busy === "submit" || !questions.some((qq) => answers[qq.id].text.trim())}>
                    {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Get feedback
                  </Button>
                  <CostNote action="story_drill" />
                </>
              ) : (
                <Button onClick={() => (stopListening(), setStep((s) => s + 1))}>Next question</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Behavioral drill</CardTitle>
        <CardDescription>
          Five interview questions aimed at the themes where your stories are missing or weakest. Each comes with the story that fits it best.
          Answer out loud in about two minutes, like the real thing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Button onClick={begin} disabled={busy === "load"}>
          {busy === "load" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          Start a drill
        </Button>
        <span className="text-sm text-gray-500">
          Free to practise; feedback costs <CostNote action="story_drill" />
        </span>
      </CardContent>
    </Card>
  );
};

export default DrillTab;
