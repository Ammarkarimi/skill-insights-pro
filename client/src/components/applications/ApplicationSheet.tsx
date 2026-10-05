import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, ExternalLink, Loader2, Sparkles, Target, Trash2 } from "lucide-react";
import CostNote from "@/components/CostNote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { invalidateReadiness, scoreColor } from "@/lib/readiness";
import { AppStatus, CLOSED, JobApplication, PIPELINE, STATUS_LABEL } from "@/lib/applications";

const PRIORITY_STYLE = { high: "bg-red-100 text-red-800", medium: "bg-amber-100 text-amber-800", low: "bg-gray-100 text-gray-700" };
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

type Draft = Pick<
  JobApplication,
  "company" | "title" | "jobUrl" | "location" | "salaryNote" | "contact" | "notes" | "jobDescription" | "nextLabel"
> & { nextDate: string };

const toDraft = (a: JobApplication): Draft => ({
  company: a.company,
  title: a.title,
  jobUrl: a.jobUrl,
  location: a.location,
  salaryNote: a.salaryNote,
  contact: a.contact,
  notes: a.notes,
  jobDescription: a.jobDescription,
  nextLabel: a.nextLabel,
  nextDate: a.nextDate ?? "",
});

interface Props {
  app: JobApplication | null;
  onClose: () => void;
  onChange: (app: JobApplication) => void;
  onDelete: (id: number) => void;
}

const ApplicationSheet: React.FC<Props> = ({ app, onClose, onChange, onDelete }) => {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "prep" | "target" | "delete">("");

  useEffect(() => {
    setDraft(app ? toDraft(app) : null);
  }, [app?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!app || !draft) return <Sheet open={false} />;
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(app));
  const jdReady = app.jobDescription.trim().length >= 200;

  const fail = (title: string, err: unknown) => {
    if (!isInsufficientCredits(err)) toast({ title, description: apiErrorMessage(err), variant: "destructive" });
  };
  const patch = async (body: Record<string, unknown>) => {
    const { data } = await api.patch<JobApplication>(`/api/applications/${app.id}`, body);
    onChange(data);
    return data;
  };

  const save = async () => {
    setBusy("save");
    try {
      const { nextDate, jobUrl, salaryNote, nextLabel, jobDescription, ...rest } = draft;
      const data = await patch({
        ...rest,
        job_url: jobUrl,
        salary_note: salaryNote,
        next_label: nextLabel,
        job_description: jobDescription,
        ...(nextDate ? { next_date: nextDate } : { clear_next_date: true }),
      });
      setDraft(toDraft(data));
      toast({ title: "Saved" });
    } catch (err) {
      fail("Could not save", err);
    } finally {
      setBusy("");
    }
  };

  const setStatus = (status: string) => patch({ status }).catch((err) => fail("Could not update the status", err));
  const toggle = (key: string, done: boolean) => patch({ checklist: { [key]: done } }).catch((err) => fail("Could not update", err));

  const prepKit = async () => {
    setBusy("prep");
    try {
      const { data } = await api.post<JobApplication>(`/api/applications/${app.id}/prep-kit`);
      onChange(data);
    } catch (err) {
      fail("Could not build the prep kit", err);
    } finally {
      setBusy("");
    }
  };

  const makeTarget = async () => {
    setBusy("target");
    try {
      const { data } = await api.post<{ application: JobApplication }>(`/api/applications/${app.id}/make-target`);
      onChange(data.application);
      invalidateReadiness();
      toast({ title: "Target role set", description: "Your dashboard now scores your readiness for this job." });
    } catch (err) {
      fail("Could not set the target role", err);
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${app.title} at ${app.company}?`)) return;
    setBusy("delete");
    try {
      await api.delete(`/api/applications/${app.id}`);
      onDelete(app.id);
    } catch (err) {
      fail("Could not delete", err);
      setBusy("");
    }
  };

  const field = (key: keyof Draft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`app-${key}`}>{label}</Label>
      <Input id={`app-${key}`} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} {...props} />
    </div>
  );

  const stages = [...new Set(app.checklist.map((c) => c.stage))];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-6">
            {app.title} <span className="text-gray-500 font-normal">at {app.company}</span>
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            Added {date(app.createdAt)}
            {app.jobUrl && (
              <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Job posting <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 w-48">
              <Label>Stage</Label>
              <Select value={app.status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...PIPELINE, ...CLOSED].map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" className="text-red-600 ml-auto" onClick={remove} disabled={busy === "delete"}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>

          <section>
            <h3 className="font-semibold mb-2">Prep checklist</h3>
            <div className="space-y-4">
              {stages.map((stage) => (
                <div key={stage}>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{STATUS_LABEL[stage as AppStatus]}</p>
                  <ul className="space-y-1">
                    {app.checklist
                      .filter((c) => c.stage === stage)
                      .map((c) => (
                        <li key={c.key} className="flex items-center gap-3 rounded-md border bg-white px-3 py-2">
                          <Checkbox checked={c.done} onCheckedChange={(v) => toggle(c.key, v === true)} aria-label={`Mark "${c.label}" done`} />
                          <span className={`flex-1 text-sm ${c.done ? "line-through text-gray-400" : ""}`}>{c.label}</span>
                          {c.href && (
                            <Button asChild size="sm" variant="outline">
                              <Link to={c.href}>
                                Open <ArrowRight className="h-3 w-3 ml-1" />
                              </Link>
                            </Button>
                          )}
                          {c.action === "make_target" && (
                            <Button size="sm" variant="outline" onClick={makeTarget} disabled={!jdReady || busy === "target"} title={jdReady ? "" : "Add the full job description first"}>
                              {busy === "target" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Target className="h-3 w-3 mr-1" />}
                              Score it <CostNote action="target_role_setup" className="ml-1" />
                            </Button>
                          )}
                          {c.action === "prep_kit" && (
                            <Button size="sm" variant="outline" onClick={prepKit} disabled={!jdReady || busy === "prep"} title={jdReady ? "" : "Add the full job description first"}>
                              {busy === "prep" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                              {app.prep ? "Rebuild" : "Build"} <CostNote action="prep_kit" className="ml-1" />
                            </Button>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
            {!jdReady && <p className="text-xs text-amber-700 mt-2">Paste the full job description below to unlock the readiness score and prep kit.</p>}
          </section>

          {app.prep && (
            <section className="rounded-lg border bg-blue-50/40 p-4 space-y-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Interview prep kit
                </h3>
                <p className="text-sm text-gray-700 mt-1">{app.prep.roleSummary}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Skills to brush up</h4>
                <ul className="space-y-1">
                  {app.prep.focusSkills.map((s) => (
                    <li key={s.skill} className="text-sm flex flex-wrap items-center gap-2">
                      <Badge className={PRIORITY_STYLE[s.priority]} variant="secondary">
                        {s.priority}
                      </Badge>
                      <span className="font-medium">{s.skill}</span>
                      {s.yourScore !== null && <span className={`text-xs font-semibold ${scoreColor(s.yourScore)}`}>you: {s.yourScore}</span>}
                      <span className="text-gray-600">{s.why}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Likely questions</h4>
                <ol className="list-decimal pl-5 space-y-2 text-sm">
                  {app.prep.likelyQuestions.map((q) => (
                    <li key={q.question}>
                      {q.question} <Badge variant="outline" className="ml-1 capitalize">{q.type.replace("_", " ")}</Badge>
                      <p className="text-xs text-gray-600">{q.tip}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-1">Questions to ask them</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {app.prep.questionsToAsk.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Research before you go</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {app.prep.researchChecklist.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="font-semibold">Details</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {field("title", "Job title", { maxLength: 120 })}
              {field("company", "Company", { maxLength: 120 })}
              {field("jobUrl", "Job link", { maxLength: 500, placeholder: "https://" })}
              {field("location", "Location", { maxLength: 120 })}
              {field("salaryNote", "Salary", { maxLength: 120, placeholder: "e.g. $120-140k" })}
              {field("contact", "Contact", { maxLength: 200, placeholder: "Recruiter name, email" })}
              {field("nextDate", "Next date", { type: "date" })}
              {field("nextLabel", "What's happening then", { maxLength: 120, placeholder: "e.g. Onsite interview" })}
            </div>
            <div className="space-y-1">
              <Label htmlFor="app-notes">Notes</Label>
              <Textarea id="app-notes" rows={3} maxLength={5000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="app-jd">Job description</Label>
              <Textarea id="app-jd" rows={6} maxLength={12000} value={draft.jobDescription} onChange={(e) => setDraft({ ...draft, jobDescription: e.target.value })} placeholder="Paste the full job posting" />
            </div>
            <Button onClick={save} disabled={!dirty || busy === "save" || !draft.title.trim() || !draft.company.trim()}>
              {busy === "save" && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save changes
            </Button>
          </section>

          <section>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> History
            </h3>
            <ol className="border-l pl-4 space-y-2 text-sm">
              {[...app.history].reverse().map((h, i) => (
                <li key={i}>
                  <span className="font-medium">{STATUS_LABEL[h.status]}</span> <span className="text-gray-500">· {date(h.at)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ApplicationSheet;
