import React, { useEffect, useState } from "react";
import { AlertTriangle, Copy, Download, FileText, Heart, Linkedin, Loader2, Mail, Sparkles, Users } from "lucide-react";
import Layout from "@/components/Layout";
import FileUpload from "@/components/FileUpload";
import CostNote from "@/components/CostNote";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { fetchReadiness, TargetRole } from "@/lib/readiness";

type Kind = "cover_letter" | "recruiter_email" | "linkedin_note" | "referral_request" | "thank_you";

const KINDS: { value: Kind; label: string; hint: string; icon: React.ReactNode; notes: string }[] = [
  { value: "cover_letter", label: "Cover letter", hint: "250–350 words", icon: <FileText className="h-5 w-5" />, notes: "Anything to emphasise (optional)" },
  { value: "recruiter_email", label: "Recruiter email", hint: "Cold outreach, <150 words", icon: <Mail className="h-5 w-5" />, notes: "Context, e.g. saw the post on LinkedIn (optional)" },
  { value: "linkedin_note", label: "LinkedIn note", hint: "≤300 characters", icon: <Linkedin className="h-5 w-5" />, notes: "Why you want to connect (optional)" },
  { value: "referral_request", label: "Referral request", hint: "Ask a contact to refer you", icon: <Users className="h-5 w-5" />, notes: "How you know them (optional)" },
  { value: "thank_you", label: "Thank-you note", hint: "After an interview", icon: <Heart className="h-5 w-5" />, notes: "What you discussed in the interview (required)" },
];

interface Result {
  type: Kind;
  subject: string;
  body: string;
  wordCount: number;
  charCount: number;
  highlights: string[];
  tips: string[];
  warnings: string[];
}

const Letters: React.FC = () => {
  const { toast } = useToast();
  const [kind, setKind] = useState<Kind>("cover_letter");
  const [tone, setTone] = useState("professional");
  const [saved, setSaved] = useState<{ id: number; jobTitle: string; company: string }[]>([]);
  const [source, setSource] = useState<string>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [recipient, setRecipient] = useState("");
  const [jd, setJd] = useState("");
  const [notes, setNotes] = useState("");
  const [target, setTarget] = useState<TargetRole | null>(null);
  const [useTarget, setUseTarget] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ resumes: { id: number; jobTitle: string; company: string }[] }>("/api/tailor")
      .then((r) => {
        setSaved(r.data.resumes);
        if (r.data.resumes.length) setSource(String(r.data.resumes[0].id));
      })
      .catch(() => undefined);
    fetchReadiness()
      .then((r) => setTarget(r.target))
      .catch(() => undefined);
  }, []);

  const meta = KINDS.find((k) => k.value === kind)!;
  const fromSaved = source !== "upload";
  const canWrite = (fromSaved || !!file) && (kind !== "thank_you" || notes.trim().length > 0);

  const write = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      Object.entries({ kind, tone, job_title: jobTitle, company, job_description: jd, recipient_name: recipient, notes }).forEach(([k, v]) =>
        form.append(k, v),
      );
      form.append("use_target", useTarget && target ? "true" : "false");
      if (fromSaved) form.append("tailored_id", source);
      else if (file) form.append("resume", file);
      const { data } = await api.post<Result>("/api/letters", form);
      setResult(data);
      setSubject(data.subject);
      setBody(data.body);
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not write your message", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(subject ? `Subject: ${subject}\n\n${body}` : body).then(() => toast({ title: "Copied to clipboard" }));
  };

  const download = async () => {
    try {
      const res = await api.post(
        "/api/letters/export",
        { subject, body, filename: `${meta.label} ${company}`.trim() },
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${meta.label} ${company}`.trim().replace(/[^A-Za-z0-9]+/g, "_") + ".docx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast({ title: "Download failed", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  const overLimit = kind === "linkedin_note" && body.length > 300;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="page-header">Cover Letters &amp; Outreach</h1>
        <p className="text-gray-600 -mt-4 mb-6">Specific, human-sounding messages built only from what is really on your resume.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => setKind(k.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${kind === k.value ? "border-primary bg-primary/5" : "hover:bg-gray-50"}`}
            >
              <span className={kind === k.value ? "text-primary" : "text-gray-500"}>{k.icon}</span>
              <span className="block font-medium text-sm mt-1">{k.label}</span>
              <span className="block text-xs text-gray-500">{k.hint}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Your resume</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {saved.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        Tailored: {s.jobTitle || "Untitled"}
                        {s.company ? ` at ${s.company}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="upload">Upload a resume file</SelectItem>
                  </SelectContent>
                </Select>
                {!fromSaved && <FileUpload onFilesChange={(f) => setFile(f[0] ?? null)} />}
              </div>
              {target && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={useTarget} onCheckedChange={(v) => setUseTarget(v === true)} />
                  Use my target role ({target.title}) when the job fields are empty
                </label>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="l-title">Job title</Label>
                  <Input id="l-title" value={jobTitle} maxLength={120} onChange={(e) => setJobTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="l-company">Company</Label>
                  <Input id="l-company" value={company} maxLength={120} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="l-recipient">Recipient name</Label>
                  <Input id="l-recipient" value={recipient} maxLength={120} placeholder="Optional" onChange={(e) => setRecipient(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["professional", "warm", "concise", "enthusiastic"].map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="l-notes">{meta.notes}</Label>
                <Textarea id="l-notes" rows={3} maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="l-jd">Job description (recommended)</Label>
                <Textarea id="l-jd" rows={5} maxLength={12000} value={jd} onChange={(e) => setJd(e.target.value)} placeholder={fromSaved ? "Leave empty to reuse the tailored resume's job" : ""} />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end items-center gap-3">
              <CostNote action="letter" />
              <Button onClick={write} disabled={busy || !canWrite}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {result ? "Write a new version" : `Write ${meta.label.toLowerCase()}`}
              </Button>
            </CardFooter>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">{result ? meta.label : "Your message"}</CardTitle>
              {!result && <CardDescription>Your draft appears here. You can edit it before copying or downloading.</CardDescription>}
            </CardHeader>
            {result && (
              <>
                <CardContent className="space-y-4 flex-1">
                  {result.warnings.length > 0 && (
                    <Alert className="border-amber-300 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription>
                        {result.warnings.map((w) => (
                          <p key={w}>{w}</p>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )}
                  {kind !== "cover_letter" && kind !== "linkedin_note" && (
                    <div className="space-y-1">
                      <Label htmlFor="l-subject">Subject</Label>
                      <Input id="l-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>
                  )}
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[320px] text-sm leading-relaxed" />
                  <p className={`text-xs ${overLimit ? "text-red-600 font-medium" : "text-gray-500"}`}>
                    {body.trim().split(/\s+/).filter(Boolean).length} words · {body.length} characters
                    {kind === "linkedin_note" && " (LinkedIn limit 300)"}
                  </p>
                  {result.tips.length > 0 && (
                    <div className="text-sm">
                      <h4 className="font-semibold mb-1">Make it even better</h4>
                      <ul className="list-disc pl-5 text-gray-600 space-y-1">
                        {result.tips.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2 justify-end">
                  <Button variant="outline" onClick={copy}>
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                  <Button onClick={download}>
                    <Download className="mr-2 h-4 w-4" /> Word (.docx)
                  </Button>
                </CardFooter>
              </>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Letters;
