import React, { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Volume2, VolumeX, ShieldCheck, ShieldAlert, ShieldX, Send, Flag, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUpload from "@/components/FileUpload";
import CostNote from "@/components/CostNote";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { fetchReadiness, invalidateReadiness } from "@/lib/readiness";
import { getRecognition, isSpeechSupported, READINESS_LABELS, speak, SpeechRecognitionLike, stopSpeaking } from "@/lib/speech";
import { DeliveryTracker } from "@/lib/deliveryMetrics";

interface Turn {
  role: "interviewer" | "candidate";
  topic: number;
  kind?: "opening" | "follow_up";
  text: string;
}

interface TopicResult {
  index: number;
  requirement: string;
  claim: string;
  question: string;
  answered: boolean;
  score: number;
  claimVerdict: "supported" | "weak" | "unsupported";
  verdictReason: string;
  strengths: string[];
  improvements: string[];
  resumeFix: string;
  modelAnswer: string;
}

interface Session {
  id: number;
  roleTitle: string;
  status: "active" | "ready" | "completed";
  topicCount: number;
  currentTopic: number;
  topics: { index: number; requirement: string; claim: string }[];
  transcript: Turn[];
  question: Turn | null;
  answers: number;
  report: null | {
    overall: { overall_score: number; readiness: string; summary: string; communication: string; top_strengths: string[]; focus_next: string[] };
    topics: TopicResult[];
    delivery: null | { voiceAnswers: number; wordsPerMinute: number; fillersPerMinute: number; longPauses: number };
  };
}

const VERDICT = {
  supported: { label: "Supported", icon: <ShieldCheck className="h-4 w-4 text-green-600" />, className: "bg-green-100 text-green-800" },
  weak: { label: "Weak", icon: <ShieldAlert className="h-4 w-4 text-amber-600" />, className: "bg-amber-100 text-amber-800" },
  unsupported: { label: "Unsupported", icon: <ShieldX className="h-4 w-4 text-red-600" />, className: "bg-red-100 text-red-800" },
};

const paceNote = (wpm: number) =>
  wpm < 110 ? "a little slow; aim for 120–160" : wpm > 170 ? "fast; slow down to 120–160 for clarity" : "a clear, natural pace";

const DeepInterview: React.FC<{ openId?: number | null }> = ({ openId }) => {
  const { toast } = useToast();
  const [resume, setResume] = useState<File | null>(null);
  const [roleTitle, setRoleTitle] = useState("");
  const [targetTitle, setTargetTitle] = useState<string | null>(null);
  const [topics, setTopics] = useState("5");
  const [session, setSession] = useState<Session | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"" | "start" | "answer" | "finish">("");
  const [listening, setListening] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const trackerRef = useRef(new DeliveryTracker());
  const baseRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);
  const voice = isSpeechSupported();

  useEffect(() => {
    fetchReadiness()
      .then((r) => setTargetTitle(r.target?.title ?? null))
      .catch(() => undefined);
    return () => {
      recognitionRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (!openId) return;
    api
      .get<Session>(`/api/deep-interview/${openId}`)
      .then((r) => setSession(r.data))
      .catch((err) => toast({ title: "Could not load interview", description: apiErrorMessage(err), variant: "destructive" }));
  }, [openId, toast]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session?.transcript.length]);

  const fail = (title: string, err: unknown) => {
    if (!isInsufficientCredits(err)) toast({ title, description: apiErrorMessage(err), variant: "destructive" });
  };

  const ask = (s: Session) => {
    if (audioOn && s.question) speak(s.question.text);
  };

  const startListening = () => {
    const recognition = getRecognition();
    if (!recognition) return;
    stopSpeaking();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    baseRef.current = answer ? answer.trimEnd() + " " : "";
    trackerRef.current.start();
    recognition.onresult = (event) => {
      trackerRef.current.onResult();
      setAnswer(baseRef.current + Array.from(event.results).map((r) => r[0].transcript).join(""));
    };
    recognition.onend = () => {
      trackerRef.current.stop();
      setListening(false);
    };
    recognition.onerror = (e) => {
      setListening(false);
      if (e.error !== "aborted" && e.error !== "no-speech") {
        toast({ title: "Microphone error", description: `${e.error}. You can type instead.`, variant: "destructive" });
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    trackerRef.current.stop();
    setListening(false);
  };

  const start = async () => {
    if (!resume) return;
    setBusy("start");
    try {
      const form = new FormData();
      form.append("resume", resume);
      form.append("n_topics", topics);
      form.append("role_title", roleTitle.trim());
      const { data } = await api.post<Session>("/api/deep-interview/start", form);
      setSession(data);
      trackerRef.current.reset();
      setTimeout(() => ask(data), 300);
    } catch (err) {
      fail("Could not start the interview", err);
    } finally {
      setBusy("");
    }
  };

  const submitAnswer = async () => {
    if (!session || !answer.trim()) return;
    stopListening();
    setBusy("answer");
    try {
      const metrics = trackerRef.current.metrics(answer);
      const { data } = await api.post<Session>(`/api/deep-interview/${session.id}/answer`, { answer: answer.trim(), metrics });
      setSession(data);
      setAnswer("");
      trackerRef.current.reset();
      ask(data);
    } catch (err) {
      fail("Could not send your answer", err);
    } finally {
      setBusy("");
    }
  };

  const finish = async () => {
    if (!session) return;
    stopListening();
    stopSpeaking();
    setBusy("finish");
    try {
      const { data } = await api.post<Session>(`/api/deep-interview/${session.id}/finish`);
      setSession(data);
      invalidateReadiness();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      fail("Could not create your report", err);
    } finally {
      setBusy("");
    }
  };

  // ---------------------------------------------------------------- setup
  if (!session) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Defend your resume</CardTitle>
          <CardDescription>
            The interviewer picks the claims on your resume that matter most for the role and asks follow-up questions
            until each one is proven, just like a real hiring manager. You get a verdict on every claim, resume fixes and
            delivery stats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <FileUpload onFilesChange={(f) => setResume(f[0] ?? null)} busy={busy === "start"} busyLabel="Reading your resume and preparing questions..." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deep-role">Role</Label>
              <Input
                id="deep-role"
                placeholder={targetTitle ?? "e.g. Senior Backend Engineer"}
                value={roleTitle}
                maxLength={120}
                onChange={(e) => setRoleTitle(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                {targetTitle ? `Leave empty to use your target role (${targetTitle}).` : "Tip: set a target role on the dashboard to track readiness."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Claims to probe</Label>
              <Select value={topics} onValueChange={setTopics}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["3", "4", "5", "6"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n} claims (~{Number(n) * 4} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!voice && (
            <Alert>
              <AlertDescription>Voice answers and delivery stats need Chrome or Edge. You can type your answers in any browser.</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            <CostNote action="deep_interview_start" /> to start, <CostNote action="deep_interview_report" /> for the report. Follow-ups are free.
          </span>
          <Button onClick={start} disabled={!resume || busy !== "" || (!roleTitle.trim() && !targetTitle)}>
            {busy === "start" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start interview
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ---------------------------------------------------------------- report
  if (session.status === "completed" && session.report) {
    const { overall, topics: results, delivery } = session.report;
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <CardTitle>Defend your resume · {session.roleTitle}</CardTitle>
                <CardDescription className="text-base text-gray-700 mt-2">{overall.summary}</CardDescription>
              </div>
              <div className="text-center shrink-0">
                <div className="text-5xl font-bold text-primary">{overall.overall_score}</div>
                <Badge variant="secondary">{READINESS_LABELS[overall.readiness] ?? overall.readiness}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Communication</h3>
              <p className="text-gray-600">{overall.communication}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Top strengths</h3>
              <ul className="list-disc pl-5 space-y-1">{overall.top_strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Practise next</h3>
              <ul className="list-disc pl-5 space-y-1">{overall.focus_next.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          </CardContent>
        </Card>

        {delivery && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" /> Delivery
              </CardTitle>
              <CardDescription>From your {delivery.voiceAnswers} spoken answer{delivery.voiceAnswers === 1 ? "" : "s"}, measured in your browser.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <div className="text-3xl font-bold">{delivery.wordsPerMinute}</div>
                <div className="text-sm text-gray-500">words per minute</div>
                <div className="text-xs text-gray-600 mt-1">{paceNote(delivery.wordsPerMinute)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-3xl font-bold">{delivery.fillersPerMinute}</div>
                <div className="text-sm text-gray-500">filler words per minute</div>
                <div className="text-xs text-gray-600 mt-1">{delivery.fillersPerMinute <= 2 ? "Great control" : "Try pausing silently instead"}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-3xl font-bold">{delivery.longPauses}</div>
                <div className="text-sm text-gray-500">pauses over 3 seconds</div>
                <div className="text-xs text-gray-600 mt-1">Short pauses are fine; long ones can signal uncertainty</div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Claim verification</CardTitle>
            <CardDescription>How convincingly you backed up each line of your resume.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((t) => (
              <div key={t.index} className="border rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-500">{t.requirement}</p>
                    <p className="font-medium">“{t.claim}”</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT[t.claimVerdict].className}`}>
                      {VERDICT[t.claimVerdict].icon}
                      {t.answered ? VERDICT[t.claimVerdict].label : "Not reached"}
                    </span>
                    {t.answered && <Badge variant="outline">{t.score}/10</Badge>}
                  </div>
                </div>
                <p className="text-sm text-gray-600">{t.verdictReason}</p>
                {t.resumeFix && (
                  <p className="text-sm bg-amber-50 border border-amber-200 rounded p-2">
                    <strong>Resume fix:</strong> {t.resumeFix}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {t.strengths.length > 0 && (
                    <div>
                      <h4 className="font-medium text-green-700">What worked</h4>
                      <ul className="list-disc pl-5">{t.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
                    </div>
                  )}
                  {t.improvements.length > 0 && (
                    <div>
                      <h4 className="font-medium text-amber-700">To improve</h4>
                      <ul className="list-disc pl-5">{t.improvements.map((s) => <li key={s}>{s}</li>)}</ul>
                    </div>
                  )}
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-primary">Model answer to “{t.question}”</summary>
                  <p className="mt-2 text-gray-700 bg-green-50 rounded p-2">{t.modelAnswer}</p>
                </details>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="flex justify-center">
          <Button onClick={() => setSession(null)}>Start another interview</Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- live interview
  const done = session.status === "ready";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Progress value={((session.currentTopic + (done ? 1 : 0)) / session.topicCount) * 100} className="h-2 flex-1" />
        <span className="text-sm text-gray-600 whitespace-nowrap">
          Claim {Math.min(session.currentTopic + 1, session.topicCount)} / {session.topicCount}
        </span>
        <Button variant="ghost" size="icon" title={audioOn ? "Mute interviewer" : "Unmute interviewer"} onClick={() => { if (audioOn) stopSpeaking(); setAudioOn(!audioOn); }}>
          {audioOn ? <Volume2 /> : <VolumeX />}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3 max-h-[45vh] overflow-y-auto">
          {session.transcript.map((t, i) => {
            const showClaim = t.role === "interviewer" && t.kind === "opening";
            return (
              <div key={i}>
                {showClaim && (
                  <p className="text-xs text-gray-500 mb-1">
                    Probing: “{session.topics[t.topic]?.claim}” · {session.topics[t.topic]?.requirement}
                  </p>
                )}
                <div className={`flex ${t.role === "candidate" ? "justify-end" : "justify-start"}`}>
                  <div className={`px-4 py-2 rounded-lg max-w-[85%] text-sm ${t.role === "candidate" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {t.kind === "follow_up" && <span className="block text-[10px] uppercase tracking-wide text-primary font-semibold">Follow-up</span>}
                    {t.text}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </CardContent>
      </Card>

      {done ? (
        <Alert>
          <Flag className="h-4 w-4" />
          <AlertDescription>All claims covered. Get your report to see how convincingly you defended each one.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={voice ? "Press 'Answer by voice' and speak, or type your answer…" : "Type your answer…"}
              className="min-h-[140px]"
              maxLength={6000}
              disabled={busy === "answer"}
            />
            <div className="flex flex-wrap gap-2 justify-between">
              <div className="flex gap-2">
                {voice && (
                  <Button variant={listening ? "destructive" : "outline"} onClick={listening ? stopListening : startListening} disabled={busy !== ""}>
                    {listening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                    {listening ? "Stop recording" : "Answer by voice"}
                  </Button>
                )}
                {session.question && (
                  <Button variant="ghost" onClick={() => speak(session.question!.text)} disabled={!audioOn}>
                    <Volume2 className="mr-2 h-4 w-4" /> Repeat
                  </Button>
                )}
              </div>
              <Button onClick={submitAnswer} disabled={busy !== "" || !answer.trim()}>
                {busy === "answer" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send answer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row justify-end items-center gap-3">
        <CostNote action="deep_interview_report" />
        <Button variant={done ? "default" : "outline"} onClick={finish} disabled={busy !== "" || session.answers === 0}>
          {busy === "finish" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy === "finish" ? "Writing your report…" : done ? "Get my report" : "End early & get report"}
        </Button>
      </div>
    </div>
  );
};

export default DeepInterview;
