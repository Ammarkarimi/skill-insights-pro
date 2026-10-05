import React, { useEffect, useRef, useState } from "react";
import { markStepDone, useApplicationPrefill } from "@/lib/applications";
import { ChevronRight, Copy, HandCoins, History, Loader2, Send, Trophy } from "lucide-react";
import Layout from "@/components/Layout";
import CostNote from "@/components/CostNote";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";

interface Offer {
  base: number;
  signing: number;
  bonusPct: number;
  other: string[];
}
interface Session {
  id: number;
  roleTitle: string;
  status: "active" | "final" | "completed";
  scenario: {
    company_description: string;
    recruiter_name: string;
    recruiter_style: string;
    currency: string;
    market_low: number;
    market_mid: number;
    market_high: number;
    equity_note: string;
  };
  offer: Offer;
  transcript: { role: "recruiter" | "candidate"; text: string }[];
  messagesLeft: number;
  report: null | {
    overall_score: number;
    summary: string;
    skills: { skill: string; score: number; feedback: string }[];
    key_moments: { quote: string; assessment: string; better_alternative: string }[];
    scripts: { counter_offer_email: string; phone_opener: string; closing_line: string };
    outcome: {
      initial: Offer;
      final: Offer;
      ceiling: { base: number; signing: number; bonusPct: number };
      baseCapturedPct: number | null;
      totalCapturedPct: number | null;
      firstYearGain: number;
      currency: string;
      leversWon: string[];
      leversAvailable: string[];
    };
  };
}
interface HistoryItem {
  id: number;
  roleTitle: string;
  status: string;
  score: number | null;
  gain: number | null;
  currency: string;
  createdAt: string;
}

const TACTICS = [
  "Thank you, I'm excited about the role. Based on my research, the market range for this position is",
  "I have another offer at",
  "Is there flexibility on the signing bonus?",
  "Beyond base salary, could we discuss",
  "Could I have until Friday to consider the offer?",
];

const SKILL_LABELS: Record<string, string> = {
  anchoring: "Anchoring",
  justification: "Justification",
  non_salary_levers: "Non-salary levers",
  tone: "Tone & rapport",
  handling_pressure: "Handling pressure",
  closing: "Closing",
};

const Negotiation: React.FC = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({ role: "", level: "mid", location: "United States", company: "mid_size", yourOffer: "", competing: "" });
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"" | "start" | "send" | "finish">("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const money = (n: number, currency = session?.scenario.currency ?? "USD") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  const [appParams, setAppParams] = useState<URLSearchParams | null>(null);
  useApplicationPrefill((app, params) => {
    setForm((f) => ({ ...f, role: app.title.slice(0, 120), location: app.location || f.location }));
    setAppParams(params);
  });

  const loadHistory = () =>
    api
      .get<{ negotiations: HistoryItem[] }>("/api/negotiation")
      .then((r) => setHistory(r.data.negotiations))
      .catch(() => undefined);

  useEffect(() => {
    loadHistory();
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session?.transcript.length]);

  const fail = (title: string, err: unknown) => {
    if (!isInsufficientCredits(err)) toast({ title, description: apiErrorMessage(err), variant: "destructive" });
  };

  const start = async () => {
    setBusy("start");
    try {
      const { data } = await api.post<Session>("/api/negotiation/start", {
        role_title: form.role,
        level: form.level,
        location: form.location,
        company_type: form.company,
        your_offer: form.yourOffer ? Number(form.yourOffer) : null,
        competing_offer: form.competing ? Number(form.competing) : null,
      });
      setSession(data);
      if (appParams) markStepDone(appParams, "negotiate");
    } catch (err) {
      fail("Could not start the negotiation", err);
    } finally {
      setBusy("");
    }
  };

  const send = async () => {
    if (!session || !message.trim()) return;
    setBusy("send");
    try {
      const { data } = await api.post<Session>(`/api/negotiation/${session.id}/message`, { text: message.trim() });
      setSession(data);
      setMessage("");
    } catch (err) {
      fail("Message not sent", err);
    } finally {
      setBusy("");
    }
  };

  const finish = async () => {
    if (!session) return;
    setBusy("finish");
    try {
      const { data } = await api.post<Session>(`/api/negotiation/${session.id}/finish`);
      setSession(data);
      loadHistory();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      fail("Could not create your debrief", err);
    } finally {
      setBusy("");
    }
  };

  const open = async (id: number) => {
    try {
      const { data } = await api.get<Session>(`/api/negotiation/${id}`);
      setSession(data);
    } catch (err) {
      fail("Could not open negotiation", err);
    }
  };

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast({ title: "Copied" }));

  // ---------------------------------------------------------------- setup
  if (!session) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="page-header">Salary Negotiation Simulator</h1>
            <p className="text-gray-600 -mt-4">
              Practise negotiating an offer with an AI recruiter who has a hidden budget. Find out how much you left on the table,
              then get scripts you can use for real.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-primary" /> Set up the offer
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="n-role">Role</Label>
                <Input id="n-role" value={form.role} maxLength={120} placeholder="e.g. Senior Backend Engineer" onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Level</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["entry", "mid", "senior", "staff"].map((l) => (
                      <SelectItem key={l} value={l} className="capitalize">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Company type</Label>
                <Select value={form.company} onValueChange={(v) => setForm({ ...form, company: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      ["startup", "Startup"],
                      ["mid_size", "Mid-size company"],
                      ["big_tech", "Big tech"],
                      ["enterprise", "Enterprise"],
                      ["non_profit", "Non-profit"],
                    ].map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="n-loc">Location</Label>
                <Input id="n-loc" value={form.location} maxLength={120} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="n-offer">Your real offer, base (optional)</Label>
                <Input id="n-offer" inputMode="numeric" value={form.yourOffer} placeholder="e.g. 130000" onChange={(e) => setForm({ ...form, yourOffer: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="n-comp">Competing offer, base (optional)</Label>
                <Input id="n-comp" inputMode="numeric" value={form.competing} onChange={(e) => setForm({ ...form, competing: e.target.value.replace(/\D/g, "") })} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                <CostNote action="negotiation_start" /> to start, <CostNote action="negotiation_report" /> for the debrief. Messages are free.
              </span>
              <Button onClick={start} disabled={busy !== "" || form.role.trim().length < 2}>
                {busy === "start" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start negotiation
              </Button>
            </CardFooter>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" /> Past negotiations
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {history.map((h) => (
                  <button key={h.id} onClick={() => open(h.id)} className="w-full flex items-center justify-between py-3 px-2 text-left hover:bg-gray-50 rounded">
                    <span>
                      <span className="font-medium">{h.roleTitle}</span>
                      <span className="block text-xs text-gray-500">{new Date(h.createdAt).toLocaleString()}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {h.gain !== null && <span className="text-sm text-green-700">+{money(h.gain, h.currency)}</span>}
                      <Badge variant="secondary">{h.score !== null ? `${h.score}/100` : h.status}</Badge>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    );
  }

  const { scenario, offer } = session;
  const range = scenario.market_high - scenario.market_low || 1;
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - scenario.market_low) / range) * 100))}%`;

  // ---------------------------------------------------------------- debrief
  if (session.status === "completed" && session.report) {
    const r = session.report;
    const o = r.outcome;
    return (
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <CardTitle>Negotiation debrief · {session.roleTitle}</CardTitle>
                  <CardDescription className="text-base text-gray-700 mt-2">{r.summary}</CardDescription>
                </div>
                <div className="text-center shrink-0">
                  <div className="text-5xl font-bold text-primary">{r.overall_score}</div>
                  <div className="text-xs text-gray-500">technique / 100</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-500">First-year gain</div>
                <div className="text-3xl font-bold text-green-700 flex items-center gap-2">
                  <Trophy className="h-6 w-6" />+{money(o.firstYearGain, o.currency)}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-500">Base salary room captured</div>
                <div className="text-3xl font-bold">{o.baseCapturedPct ?? "n/a"}%</div>
                <Progress value={o.baseCapturedPct ?? 0} className="h-2 mt-2" />
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-500">Total package room captured</div>
                <div className="text-3xl font-bold">{o.totalCapturedPct ?? "n/a"}%</div>
                <Progress value={o.totalCapturedPct ?? 0} className="h-2 mt-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What was really on the table</CardTitle>
              <CardDescription>The recruiter's hidden budget, now revealed.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2"></th>
                    <th>First offer</th>
                    <th>You got</th>
                    <th>Their maximum</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Base salary", (x: { base: number }) => money(x.base, o.currency)],
                      ["Signing bonus", (x: { signing: number }) => money(x.signing, o.currency)],
                      ["Annual bonus", (x: { bonusPct: number }) => `${x.bonusPct}%`],
                    ] as const
                  ).map(([label, fmt]) => (
                    <tr key={label} className="border-t">
                      <td className="py-2 font-medium">{label}</td>
                      <td>{fmt(o.initial as never)}</td>
                      <td className="font-semibold text-primary">{fmt(o.final as never)}</td>
                      <td className="text-gray-600">{fmt(o.ceiling as never)}</td>
                    </tr>
                  ))}
                  <tr className="border-t">
                    <td className="py-2 font-medium">Other levers</td>
                    <td>-</td>
                    <td>{o.leversWon.join(", ") || "None"}</td>
                    <td className="text-gray-600">{o.leversAvailable.join(", ")}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your technique</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.skills.map((s) => (
                  <div key={s.skill}>
                    <div className="flex justify-between text-sm font-medium">
                      <span>{SKILL_LABELS[s.skill] ?? s.skill}</span>
                      <span>{s.score}/10</span>
                    </div>
                    <Progress value={s.score * 10} className="h-1.5 my-1" />
                    <p className="text-xs text-gray-600">{s.feedback}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key moments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {r.key_moments.map((m, i) => (
                  <div key={i} className="border-l-4 border-primary pl-3">
                    <p className="italic">“{m.quote}”</p>
                    <p className="text-gray-600 mt-1">{m.assessment}</p>
                    {m.better_alternative && <p className="text-green-700 mt-1">Try: “{m.better_alternative}”</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scripts for the real thing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {(
                [
                  ["Counter-offer email", r.scripts.counter_offer_email],
                  ["Opening the call", r.scripts.phone_opener],
                  ["Closing and locking terms", r.scripts.closing_line],
                ] as const
              ).map(([label, text]) => (
                <div key={label}>
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold">{label}</h4>
                    <Button size="sm" variant="ghost" onClick={() => copy(text)}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap bg-gray-50 border rounded p-3">{text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex justify-center">
            <Button onClick={() => setSession(null)}>Practise another negotiation</Button>
          </div>
        </div>
      </Layout>
    );
  }

  // ---------------------------------------------------------------- live call
  const ended = session.status === "final";
  return (
    <Layout>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                Call with {scenario.recruiter_name} <Badge variant="outline" className="ml-2 capitalize">{scenario.recruiter_style.replace("_", "-")}</Badge>
              </CardTitle>
              <CardDescription>{scenario.company_description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[50vh] overflow-y-auto">
              {session.transcript.map((t, i) => (
                <div key={i} className={`flex ${t.role === "candidate" ? "justify-end" : "justify-start"}`}>
                  <div className={`px-4 py-2 rounded-lg max-w-[85%] text-sm whitespace-pre-wrap ${t.role === "candidate" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {t.text}
                  </div>
                </div>
              ))}
              {busy === "send" && (
                <div className="flex">
                  <div className="bg-muted px-4 py-2 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </CardContent>
          </Card>

          {!ended ? (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {TACTICS.map((t) => (
                    <button key={t} onClick={() => setMessage(t + " ")} className="text-xs border rounded-full px-3 py-1 hover:bg-gray-50">
                      {t.length > 48 ? t.slice(0, 46) + "…" : t}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={message}
                  maxLength={2000}
                  rows={3}
                  placeholder="What do you say?"
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{session.messagesLeft} messages left</span>
                  <Button onClick={send} disabled={busy !== "" || !message.trim()}>
                    <Send className="mr-2 h-4 w-4" /> Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-center text-gray-600">The recruiter has made a final offer. Get your debrief to see how you did.</p>
          )}
          <div className="flex justify-end items-center gap-3">
            <CostNote action="negotiation_report" />
            <Button variant={ended ? "default" : "outline"} onClick={finish} disabled={busy !== "" || session.transcript.length < 2}>
              {busy === "finish" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {ended ? "Get my debrief" : "Accept / end & get debrief"}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Current offer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Base</span>
                <strong>{money(offer.base)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Signing bonus</span>
                <strong>{money(offer.signing)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Annual bonus</span>
                <strong>{offer.bonusPct}%</strong>
              </div>
              {scenario.equity_note && <p className="text-xs text-gray-600">{scenario.equity_note}</p>}
              {offer.other.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {offer.other.map((o) => (
                    <Badge key={o} variant="secondary">
                      {o}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Market range (base)</CardTitle>
              <CardDescription className="text-xs">AI estimate for this role, level and location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-2 rounded-full bg-gradient-to-r from-amber-200 via-green-300 to-green-500 mt-4 mb-6">
                <div className="absolute -top-5 -translate-x-1/2 text-[10px] font-semibold text-primary" style={{ left: pos(offer.base) }}>
                  you
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-1 bg-primary rounded" style={{ left: pos(offer.base) }} />
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>{money(scenario.market_low)}</span>
                <span>median {money(scenario.market_mid)}</span>
                <span>{money(scenario.market_high)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Negotiation;
