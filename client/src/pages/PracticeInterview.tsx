import React, { useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import CostNote from "@/components/CostNote";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Mic, MicOff, Volume2, VolumeX, MessageSquare, History, ChevronRight, PhoneOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { getRecognition, READINESS_LABELS, SpeechRecognitionLike } from "@/lib/speech";
import { useSearchParams } from "react-router-dom";
import DeepInterview from "@/components/interview/DeepInterview";

const TOPICS = [
  "Frontend Development",
  "Backend Development",
  "Full Stack Development",
  "Data Science",
  "Machine Learning Engineering",
  "DevOps & Cloud",
  "Mobile Development",
  "Product Management",
  "UI/UX Design",
  "Data Analysis",
];

interface Question {
  question: string;
  focus: string;
  type: string;
}

interface AnswerFeedback {
  question: string;
  userAnswer: string;
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
}

interface Evaluation {
  id: number;
  topic: string;
  difficulty: string;
  createdAt: string;
  answers: AnswerFeedback[];
  overall: {
    overall_score: number;
    readiness: string;
    summary: string;
    communication: string;
    top_strengths: string[];
    focus_next: string[];
  };
}

interface HistoryItem {
  id: number;
  kind: "quick" | "deep";
  topic: string;
  difficulty: string;
  overallScore: number;
  createdAt: string;
}


const PracticeInterview: React.FC = () => {
  const { toast } = useToast();
  const { cost } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"quick" | "deep">(searchParams.get("mode") === "deep" ? "deep" : "quick");
  const [deepOpenId, setDeepOpenId] = useState<number | null>(null);
  const [step, setStep] = useState<"setup" | "interview" | "results">("setup");
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [count, setCount] = useState("5");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseAnswerRef = useRef("");
  const indexRef = useRef(0);
  const speechSupported = typeof window !== "undefined" && !!getRecognition();

  const topicName = topic === "custom" ? customTopic.trim() : topic;

  const loadHistory = () =>
    api
      .get<{ interviews: HistoryItem[] }>("/api/interview/history")
      .then((r) => setHistory(r.data.interviews))
      .catch(() => undefined);

  useEffect(() => {
    loadHistory();
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const setAnswer = (value: string) =>
    setAnswers((prev) => {
      const next = [...prev];
      next[indexRef.current] = value;
      return next;
    });

  const speak = (text: string) => {
    if (!audioOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const recognition = getRecognition();
    if (!recognition) return;
    window.speechSynthesis?.cancel();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    baseAnswerRef.current = answers[index] ? answers[index].trimEnd() + " " : "";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setAnswer(baseAnswerRef.current + transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => {
      setIsListening(false);
      if (e.error !== "aborted" && e.error !== "no-speech") {
        toast({ title: "Microphone error", description: `${e.error}. You can type your answer instead.`, variant: "destructive" });
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const start = async () => {
    if (!topicName) {
      toast({ title: "Choose a topic", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await api.post<{ questions: Question[] }>("/api/interview/questions", {
        topic: topicName,
        difficulty,
        count: Number(count),
      });
      setQuestions(data.questions);
      setAnswers(data.questions.map(() => ""));
      setIndex(0);
      setEvaluation(null);
      setStep("interview");
      setTimeout(() => speak(data.questions[0].question), 400);
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not start interview", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const next = () => {
    stopListening();
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setTimeout(() => speak(questions[nextIndex].question), 300);
  };

  const finish = async () => {
    stopListening();
    window.speechSynthesis?.cancel();
    setIsLoading(true);
    try {
      const { data } = await api.post<Evaluation>("/api/interview/evaluate", {
        topic: topicName,
        difficulty,
        answers: questions.map((q, i) => ({ question: q.question, answer: answers[i] || "" })),
      });
      setEvaluation(data);
      setStep("results");
      loadHistory();
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not evaluate interview", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openPast = async (id: number, kind: HistoryItem["kind"] = "quick") => {
    if (kind === "deep") {
      setDeepOpenId(id);
      setMode("deep");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    try {
      const { data } = await api.get<Evaluation>(`/api/interview/${id}`);
      setEvaluation(data);
      setStep("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast({ title: "Could not load interview", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  const endInterview = () => {
    stopListening();
    window.speechSynthesis?.cancel();
    setStep("setup");
  };

  const answeredCount = answers.filter((a) => a.trim()).length;
  const isLast = index === questions.length - 1;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-4">
        <h1 className="text-3xl font-bold mb-6 text-center">Practice Interview</h1>

        {(mode === "deep" || step === "setup") && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-lg border bg-muted p-1" role="tablist">
              {([
                ["quick", "Quick practice"],
                ["deep", "Defend my resume"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => {
                    setMode(value);
                    setDeepOpenId(null);
                  }}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${mode === value ? "bg-white shadow-sm font-medium" : "text-gray-600"}`}
                >
                  {label}
                  {value === "deep" && <span className="ml-2 text-[10px] font-semibold text-primary">NEW</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "deep" && <DeepInterview key={deepOpenId ?? "new"} openId={deepOpenId} />}

        {mode === "quick" && step === "setup" && (
          <div className="space-y-6">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle>Set up your mock interview</CardTitle>
                <CardDescription>
                  Answer each question out loud or by typing. At the end you get a scored debrief with a model answer for
                  every question.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Role / topic</Label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOPICS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom topic…</SelectItem>
                    </SelectContent>
                  </Select>
                  {topic === "custom" && (
                    <Input
                      placeholder="e.g. React Native developer at a fintech startup"
                      value={customTopic}
                      maxLength={120}
                      onChange={(e) => setCustomTopic(e.target.value)}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <RadioGroup value={difficulty} onValueChange={setDifficulty} className="flex flex-wrap gap-4">
                    {["beginner", "intermediate", "advanced"].map((level) => (
                      <label key={level} className="flex items-center gap-2 capitalize cursor-pointer">
                        <RadioGroupItem value={level} /> {level}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>Number of questions</Label>
                  <Select value={count} onValueChange={setCount}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["3", "5", "7", "10"].map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!speechSupported && (
                  <Alert>
                    <AlertDescription>
                      Voice answers need Chrome or Edge. In this browser you can type your answers instead.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Costs {cost("interview_questions") + cost("interview_evaluation")} credits in total (questions + feedback report)
                </span>
                <Button onClick={start} disabled={isLoading || !topicName}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start interview
                </Button>
              </CardFooter>
            </Card>

            {history.length > 0 && (
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5" /> Past interviews
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  {history.map((h) => (
                    <button key={h.id} onClick={() => openPast(h.id, h.kind)} className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 px-2 rounded">
                      <span>
                        <span className="font-medium">{h.topic}</span>
                        <span className="text-xs text-gray-500 block">
                          {h.difficulty} · {new Date(h.createdAt).toLocaleString()}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary">{h.overallScore}/100</Badge>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {mode === "quick" && step === "interview" && questions[index] && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Progress value={((index + 1) / questions.length) * 100} className="h-2 flex-1" />
              <span className="text-sm text-gray-600 whitespace-nowrap">
                {index + 1} / {questions.length}
              </span>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="size-10 bg-primary rounded-full flex items-center justify-center shrink-0">
                    <MessageSquare className="size-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="secondary">{questions[index].type.replace("_", " ")}</Badge>
                      <Badge variant="outline">{questions[index].focus}</Badge>
                      {isSpeaking && <Badge className="bg-blue-500">Interviewer speaking…</Badge>}
                    </div>
                    <CardTitle className="text-xl leading-snug">{questions[index].question}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={answers[index] || ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={speechSupported ? "Press 'Answer by voice' and speak, or type your answer here…" : "Type your answer here…"}
                  className="min-h-[180px]"
                  maxLength={6000}
                />
                <div className="flex flex-wrap gap-2">
                  {speechSupported && (
                    <Button variant={isListening ? "destructive" : "default"} onClick={isListening ? stopListening : startListening}>
                      {isListening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                      {isListening ? "Stop recording" : "Answer by voice"}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => speak(questions[index].question)} disabled={isSpeaking || !audioOn}>
                    <Volume2 className="mr-2 h-4 w-4" /> Repeat question
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={audioOn ? "Mute interviewer" : "Unmute interviewer"}
                    onClick={() => {
                      if (audioOn) window.speechSynthesis?.cancel();
                      setAudioOn(!audioOn);
                    }}
                  >
                    {audioOn ? <Volume2 /> : <VolumeX />}
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-between gap-3">
                <Button variant="ghost" className="text-red-600" onClick={endInterview}>
                  <PhoneOff className="mr-2 h-4 w-4" /> End without feedback
                </Button>
                <div className="flex items-center gap-3">
                  {isLast && <CostNote action="interview_evaluation" />}
                  {isLast ? (
                    <Button onClick={finish} disabled={isLoading || answeredCount === 0}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isLoading ? "Evaluating your answers…" : "Finish & get feedback"}
                    </Button>
                  ) : (
                    <Button onClick={next}>{answers[index]?.trim() ? "Next question" : "Skip question"}</Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          </div>
        )}

        {mode === "quick" && step === "results" && evaluation && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <CardTitle>
                      {evaluation.topic} · <span className="capitalize">{evaluation.difficulty}</span>
                    </CardTitle>
                    <CardDescription className="text-base text-gray-700 mt-2">{evaluation.overall.summary}</CardDescription>
                  </div>
                  <div className="text-center shrink-0">
                    <div className="text-5xl font-bold text-primary">{evaluation.overall.overall_score}</div>
                    <Badge variant="secondary">{READINESS_LABELS[evaluation.overall.readiness] ?? evaluation.overall.readiness}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <h3 className="font-semibold mb-2">Communication</h3>
                  <p className="text-gray-600">{evaluation.overall.communication}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Top strengths</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {evaluation.overall.top_strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Practise next</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {evaluation.overall.focus_next.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {evaluation.answers.map((a, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex justify-between gap-4">
                    <CardTitle className="text-base">
                      Q{i + 1}. {a.question}
                    </CardTitle>
                    <Badge className={a.score >= 7 ? "bg-green-600" : a.score >= 5 ? "bg-amber-500" : "bg-red-500"}>{a.score}/10</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="border-l-4 border-blue-500 pl-3">
                    <h4 className="font-medium text-blue-700">Your answer</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{a.userAnswer || "No answer provided"}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {a.strengths.length > 0 && (
                      <div>
                        <h4 className="font-medium text-green-700">What worked</h4>
                        <ul className="list-disc pl-5">
                          {a.strengths.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.improvements.length > 0 && (
                      <div>
                        <h4 className="font-medium text-amber-700">To improve</h4>
                        <ul className="list-disc pl-5">
                          {a.improvements.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="border-l-4 border-green-500 pl-3 bg-green-50 py-2 rounded-r">
                    <h4 className="font-medium text-green-700">Model answer</h4>
                    <p className="text-gray-700">{a.modelAnswer}</p>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => setStep("setup")}>
                Back
              </Button>
              <Button onClick={start} disabled={isLoading || !topicName}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Practise again
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PracticeInterview;
