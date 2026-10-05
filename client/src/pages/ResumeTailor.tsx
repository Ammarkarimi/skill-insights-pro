import React, { useEffect, useState } from "react";
import { AlertTriangle, Download, FileText, Loader2, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import Layout from "@/components/Layout";
import FileUpload from "@/components/FileUpload";
import CostNote from "@/components/CostNote";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { fetchReadiness, TargetRole } from "@/lib/readiness";
import { markStepDone, useApplicationPrefill } from "@/lib/applications";

interface Role {
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
}
interface Content {
  contact: { name: string; email: string; phone: string; location: string; links: string[] };
  headline: string;
  summary: string;
  skills: { category: string; items: string[] }[];
  experience: Role[];
  projects: { name: string; tech: string[]; link: string; bullets: string[] }[];
  education: { degree: string; institution: string; location: string; start: string; end: string; details: string }[];
  certifications: string[];
}
interface Tailored {
  id: number;
  jobTitle: string;
  company: string;
  content: Content;
  changes: { section: string; before: string; after: string; reason: string }[];
  keywordsAdded: string[];
  keywordsMissing: string[];
  warnings: string[];
  placeholders: number;
}
interface SavedItem {
  id: number;
  jobTitle: string;
  company: string;
  updatedAt: string;
}

const hasPlaceholder = (t: string) => /\[[^\]]{1,30}\]/.test(t);

const BulletEditor: React.FC<{ bullets: string[]; onChange: (b: string[]) => void }> = ({ bullets, onChange }) => (
  <div className="space-y-2">
    {bullets.map((b, i) => (
      <div key={i} className="flex gap-2">
        <Textarea
          value={b}
          rows={2}
          maxLength={500}
          onChange={(e) => onChange(bullets.map((x, j) => (j === i ? e.target.value : x)))}
          className={`text-sm ${hasPlaceholder(b) ? "border-amber-400 bg-amber-50" : ""}`}
        />
        <Button variant="ghost" size="icon" onClick={() => onChange(bullets.filter((_, j) => j !== i))} title="Remove bullet">
          <X className="h-4 w-4" />
        </Button>
      </div>
    ))}
    <Button variant="ghost" size="sm" onClick={() => onChange([...bullets, ""])}>
      <Plus className="h-4 w-4 mr-1" /> Add bullet
    </Button>
  </div>
);

const ResumeTailor: React.FC = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jd, setJd] = useState("");
  const [target, setTarget] = useState<TargetRole | null>(null);
  const [useTarget, setUseTarget] = useState(false);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [doc, setDoc] = useState<Tailored | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "create" | "save" | "docx" | "pdf" | "delete">("");

  const loadSaved = () =>
    api
      .get<{ resumes: SavedItem[] }>("/api/tailor")
      .then((r) => setSaved(r.data.resumes))
      .catch(() => undefined);

  useEffect(() => {
    loadSaved();
    fetchReadiness()
      .then((r) => {
        setTarget(r.target);
        // Opened from an application: tailor for that job, not the target role.
        setUseTarget(!!r.target?.jobDescription && !new URLSearchParams(window.location.search).get("application"));
      })
      .catch(() => undefined);
  }, []);

  const [appParams, setAppParams] = useState<URLSearchParams | null>(null);
  useApplicationPrefill((app, params) => {
    setJobTitle(app.title);
    setCompany(app.company);
    setJd(app.jobDescription);
    setUseTarget(false);
    setAppParams(params);
  });

  const forTarget = useTarget && target !== null;
  const open = (t: Tailored) => {
    setDoc(t);
    setContent(t.content);
    setDirty(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const edit = (fn: (c: Content) => void) => {
    setContent((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };
  const fail = (title: string, err: unknown) => {
    if (!isInsufficientCredits(err)) toast({ title, description: apiErrorMessage(err), variant: "destructive" });
  };

  const create = async () => {
    if (!file) return;
    setBusy("create");
    try {
      const form = new FormData();
      form.append("resume", file);
      form.append("job_description", jd);
      form.append("job_title", jobTitle);
      form.append("company", company);
      form.append("use_target", forTarget ? "true" : "false");
      const { data } = await api.post<Tailored>("/api/tailor", form);
      open(data);
      loadSaved();
      if (appParams) markStepDone(appParams, "tailor");
    } catch (err) {
      fail("Could not tailor your resume", err);
    } finally {
      setBusy("");
    }
  };

  const save = async (): Promise<boolean> => {
    if (!doc || !content) return false;
    setBusy("save");
    try {
      const { data } = await api.put<Tailored>(`/api/tailor/${doc.id}`, content);
      setDoc(data);
      setDirty(false);
      return true;
    } catch (err) {
      fail("Could not save", err);
      return false;
    } finally {
      setBusy("");
    }
  };

  const download = async (format: "docx" | "pdf") => {
    if (!doc) return;
    if (dirty && !(await save())) return;
    setBusy(format);
    try {
      const res = await api.get(`/api/tailor/${doc.id}/export`, { params: { format }, responseType: "blob" });
      const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"] ?? "")?.[1] ?? `resume.${format}`;
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      fail("Download failed", err);
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!doc || !window.confirm("Delete this tailored resume?")) return;
    setBusy("delete");
    try {
      await api.delete(`/api/tailor/${doc.id}`);
      setDoc(null);
      setContent(null);
      loadSaved();
    } catch (err) {
      fail("Could not delete", err);
    } finally {
      setBusy("");
    }
  };

  const openSaved = async (id: number) => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    try {
      const { data } = await api.get<Tailored>(`/api/tailor/${id}`);
      open(data);
    } catch (err) {
      fail("Could not open resume", err);
    }
  };

  const placeholders = content
    ? [content.summary, ...content.experience.flatMap((r) => r.bullets), ...content.projects.flatMap((p) => p.bullets)].reduce(
        (n, t) => n + (t.match(/\[[^\]]{1,30}\]/g)?.length ?? 0),
        0,
      )
    : 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="page-header">Resume Tailor</h1>
        <p className="text-gray-600 -mt-4 mb-6">
          Rewrite your resume for a specific job without inventing anything, then download an ATS-friendly Word or PDF file.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            {!doc || !content ? (
              <Card>
                <CardHeader>
                  <CardTitle>Tailor a resume to a job</CardTitle>
                  <CardDescription>
                    We reorder and rewrite what you have to match the job's language. Missing metrics become [placeholders] for
                    you to fill in. We never add skills, jobs or numbers you don't have.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FileUpload onFilesChange={(f) => setFile(f[0] ?? null)} busy={busy === "create"} busyLabel="Tailoring your resume. This takes about 30–60 seconds..." />
                  {target?.jobDescription && (
                    <label className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 cursor-pointer">
                      <Checkbox checked={useTarget} onCheckedChange={(v) => setUseTarget(v === true)} className="mt-0.5" />
                      <span className="text-sm">
                        <span className="font-medium">Tailor for my target role: {target.title}</span>
                        <span className="block text-gray-600">Uses its job description unless you paste another below.</span>
                      </span>
                    </label>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="t-title">Job title</Label>
                      <Input id="t-title" value={jobTitle} maxLength={120} placeholder={forTarget ? target!.title : "e.g. Backend Engineer"} onChange={(e) => setJobTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-company">Company</Label>
                      <Input id="t-company" value={company} maxLength={120} placeholder="e.g. Stripe" onChange={(e) => setCompany(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t-jd">Job description</Label>
                    <Textarea
                      id="t-jd"
                      className="min-h-[160px]"
                      maxLength={12000}
                      value={jd}
                      placeholder={forTarget ? "Leave empty to use your target role's job description" : "Paste the full job posting"}
                      onChange={(e) => setJd(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end items-center gap-3">
                  <CostNote action="resume_tailor" />
                  <Button onClick={create} disabled={!file || busy !== "" || (!forTarget && jd.trim().length < 50)}>
                    {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Tailor my resume
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">
                      {doc.jobTitle || "Tailored resume"}
                      {doc.company && <span className="text-gray-500 font-normal"> at {doc.company}</span>}
                    </h2>
                    {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={save} disabled={!dirty || busy !== ""}>
                      {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save
                    </Button>
                    <Button onClick={() => download("docx")} disabled={busy !== ""}>
                      {busy === "docx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      Word (.docx)
                    </Button>
                    <Button variant="outline" onClick={() => download("pdf")} disabled={busy !== ""}>
                      {busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      PDF
                    </Button>
                  </div>
                </div>

                {(placeholders > 0 || doc.warnings.length > 0) && (
                  <Alert className="border-amber-300 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle>Review before sending</AlertTitle>
                    <AlertDescription className="space-y-1">
                      {placeholders > 0 && (
                        <p>
                          Fill in {placeholders} [placeholder]{placeholders === 1 ? "" : "s"} (highlighted) with your real numbers, or remove them.
                        </p>
                      )}
                      {doc.warnings.map((w) => (
                        <p key={w}>{w}</p>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

                <Card>
                  <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h3 className="font-semibold mb-2">Job keywords now covered</h3>
                      <div className="flex flex-wrap gap-1">
                        {doc.keywordsAdded.map((k) => (
                          <Badge key={k} className="bg-green-100 text-green-800 hover:bg-green-100">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Gaps we did not fake</h3>
                      <div className="flex flex-wrap gap-1">
                        {doc.keywordsMissing.map((k) => (
                          <Badge key={k} variant="outline" className="border-amber-400 text-amber-700">
                            {k}
                          </Badge>
                        ))}
                      </div>
                      {doc.keywordsMissing.length > 0 && <p className="text-xs text-gray-500 mt-1">Only add these if you genuinely have the experience.</p>}
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="edit">
                  <TabsList>
                    <TabsTrigger value="edit">Edit resume</TabsTrigger>
                    <TabsTrigger value="changes">What changed ({doc.changes.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit">
                    <Card>
                      <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(["name", "email", "phone", "location"] as const).map((f) => (
                            <div key={f} className="space-y-1">
                              <Label className="capitalize">{f}</Label>
                              <Input value={content.contact[f]} maxLength={200} onChange={(e) => edit((c) => (c.contact[f] = e.target.value))} />
                            </div>
                          ))}
                          <div className="space-y-1 sm:col-span-2">
                            <Label>Links (comma separated)</Label>
                            <Input
                              value={content.contact.links.join(", ")}
                              onChange={(e) => edit((c) => (c.contact.links = e.target.value.split(",").map((s) => s.trim()).filter(Boolean)))}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Headline</Label>
                          <Input value={content.headline} maxLength={200} onChange={(e) => edit((c) => (c.headline = e.target.value))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Summary</Label>
                          <Textarea
                            value={content.summary}
                            rows={3}
                            maxLength={1000}
                            className={hasPlaceholder(content.summary) ? "border-amber-400 bg-amber-50" : ""}
                            onChange={(e) => edit((c) => (c.summary = e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-semibold">Skills</h3>
                          {content.skills.map((g, i) => (
                            <div key={i} className="grid grid-cols-3 gap-2">
                              <Input value={g.category} placeholder="Category" onChange={(e) => edit((c) => (c.skills[i].category = e.target.value))} />
                              <Input
                                className="col-span-2"
                                value={g.items.join(", ")}
                                onChange={(e) => edit((c) => (c.skills[i].items = e.target.value.split(",").map((s) => s.trim()).filter(Boolean)))}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="space-y-4">
                          <h3 className="font-semibold">Experience</h3>
                          {content.experience.map((r, i) => (
                            <div key={i} className="border rounded-lg p-3 space-y-2">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <Input value={r.title} placeholder="Title" onChange={(e) => edit((c) => (c.experience[i].title = e.target.value))} />
                                <Input value={r.company} placeholder="Company" onChange={(e) => edit((c) => (c.experience[i].company = e.target.value))} />
                                <Input value={r.start} placeholder="Start" onChange={(e) => edit((c) => (c.experience[i].start = e.target.value))} />
                                <Input value={r.end} placeholder="End" onChange={(e) => edit((c) => (c.experience[i].end = e.target.value))} />
                              </div>
                              <BulletEditor bullets={r.bullets} onChange={(b) => edit((c) => (c.experience[i].bullets = b))} />
                            </div>
                          ))}
                        </div>
                        {content.projects.length > 0 && (
                          <div className="space-y-4">
                            <h3 className="font-semibold">Projects</h3>
                            {content.projects.map((p, i) => (
                              <div key={i} className="border rounded-lg p-3 space-y-2">
                                <Input value={p.name} placeholder="Project name" onChange={(e) => edit((c) => (c.projects[i].name = e.target.value))} />
                                <BulletEditor bullets={p.bullets} onChange={(b) => edit((c) => (c.projects[i].bullets = b))} />
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="space-y-2">
                          <h3 className="font-semibold">Education</h3>
                          {content.education.map((e2, i) => (
                            <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <Input value={e2.degree} placeholder="Degree" onChange={(e) => edit((c) => (c.education[i].degree = e.target.value))} />
                              <Input value={e2.institution} placeholder="Institution" onChange={(e) => edit((c) => (c.education[i].institution = e.target.value))} />
                              <Input value={e2.end} placeholder="Year" onChange={(e) => edit((c) => (c.education[i].end = e.target.value))} />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="changes">
                    <Card>
                      <CardContent className="pt-6 space-y-3">
                        {doc.changes.map((ch, i) => (
                          <div key={i} className="border-l-4 border-primary pl-3 py-1 text-sm">
                            <p className="text-xs font-semibold text-gray-500">{ch.section}</p>
                            {ch.before && <p className="text-red-700 line-through decoration-red-300">{ch.before}</p>}
                            <p className="text-green-700">{ch.after}</p>
                            <p className="text-gray-600 text-xs mt-1">{ch.reason}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (dirty && !window.confirm("Discard unsaved changes?")) return;
                      setDoc(null);
                      setContent(null);
                    }}
                  >
                    Tailor for another job
                  </Button>
                  <Button variant="ghost" className="text-red-600" onClick={remove} disabled={busy !== ""}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </div>
              </>
            )}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Saved versions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {saved.length === 0 && <p className="text-sm text-gray-500">Your tailored resumes appear here.</p>}
              {saved.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSaved(s.id)}
                  className={`w-full text-left rounded p-2 text-sm hover:bg-gray-50 ${doc?.id === s.id ? "bg-primary/10" : ""}`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">{s.jobTitle || "Untitled"}</span>
                  </span>
                  <span className="block text-xs text-gray-500 truncate">
                    {s.company ? `${s.company} · ` : ""}
                    {new Date(s.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ResumeTailor;
