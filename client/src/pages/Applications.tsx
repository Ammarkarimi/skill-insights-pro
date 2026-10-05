import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Briefcase, CalendarDays, CheckSquare, Loader2, Plus } from "lucide-react";
import Layout from "@/components/Layout";
import ApplicationSheet from "@/components/applications/ApplicationSheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage } from "@/lib/api";
import { AppStatus, CLOSED, JobApplication, PIPELINE, PipelineStats, STATUS_LABEL } from "@/lib/applications";

const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const EMPTY = { title: "", company: "", job_url: "", location: "", job_description: "" };

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Card>
    <CardContent className="py-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </CardContent>
  </Card>
);

const Applications: React.FC = () => {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [apps, setApps] = useState<JobApplication[] | null>(null);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const load = () =>
    api
      .get<{ applications: JobApplication[]; stats: PipelineStats }>("/api/applications")
      .then((r) => {
        setApps(r.data.applications);
        setStats(r.data.stats);
      })
      .catch((err) => {
        setApps([]);
        toast({ title: "Could not load applications", description: apiErrorMessage(err), variant: "destructive" });
      });

  useEffect(() => {
    load().then(() => {
      const id = Number(params.get("open"));
      if (id) setOpenId(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useMemo(() => apps?.find((a) => a.id === openId) ?? null, [apps, openId]);
  const columns = showClosed ? [...PIPELINE, ...CLOSED] : PIPELINE;

  const replace = (app: JobApplication) => {
    setApps((list) => (list ? list.map((a) => (a.id === app.id ? app : a)) : list));
    load();
  };
  const select = (id: number | null) => {
    setOpenId(id);
    if (id) params.set("open", String(id));
    else params.delete("open");
    setParams(params, { replace: true });
  };

  const create = async () => {
    setSaving(true);
    try {
      const { data } = await api.post<JobApplication>("/api/applications", form);
      setAdding(false);
      setForm(EMPTY);
      await load();
      select(data.id);
    } catch (err) {
      toast({ title: "Could not add the application", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const move = (app: JobApplication, status: AppStatus) =>
    api
      .patch<JobApplication>(`/api/applications/${app.id}`, { status })
      .then((r) => replace(r.data))
      .catch((err) => toast({ title: "Could not update", description: apiErrorMessage(err), variant: "destructive" }));

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="page-header mb-1">Applications</h1>
            <p className="text-gray-600">Track every job you go for, and get a prep checklist for each stage.</p>
          </div>
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add application
          </Button>
        </div>

        {stats && apps && apps.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Stat label="Applied" value={stats.applied} />
            <Stat label="Response rate" value={stats.responseRate === null ? "–" : `${stats.responseRate}%`} />
            <Stat label="Interviews" value={stats.interviews} />
            <Stat label="Offers" value={stats.offers} />
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="py-4">
                <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                  <CalendarDays className="h-3 w-3" /> Coming up
                </div>
                {stats.upcoming.length === 0 ? (
                  <div className="text-sm text-gray-500">Nothing scheduled</div>
                ) : (
                  stats.upcoming.slice(0, 2).map((u) => (
                    <button key={u.id} className="block text-left text-sm hover:underline truncate w-full" onClick={() => select(u.id)}>
                      <strong>{shortDate(u.date)}</strong> {u.label || u.company}
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {apps === null ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : apps.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-3">
              <Briefcase className="h-10 w-10 mx-auto text-gray-400" />
              <h2 className="text-lg font-semibold">Add the first job you want</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                Paste the job description and you get a checklist for every stage: tailor your resume, practise the assessment, prep the
                interview and negotiate the offer.
              </p>
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add application
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-end gap-2 mb-2 text-sm">
              <Switch id="show-closed" checked={showClosed} onCheckedChange={setShowClosed} />
              <Label htmlFor="show-closed">Show rejected and withdrawn</Label>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
              {columns.map((col) => {
                const items = apps.filter((a) => a.status === col.value);
                return (
                  <div key={col.value} className="min-w-[240px] w-[240px] shrink-0 snap-start rounded-lg bg-gray-100 p-2" aria-label={`${col.label} column`}>
                    <div className="flex justify-between items-center px-1 pb-2">
                      <h2 className="text-sm font-semibold">{col.label}</h2>
                      <span className="text-xs text-gray-500">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((a) => {
                        const done = a.checklist.filter((c) => c.done).length;
                        return (
                          <div key={a.id} className="rounded-md border bg-white p-3 shadow-sm space-y-2">
                            <button className="text-left w-full" onClick={() => select(a.id)}>
                              <div className="font-medium leading-tight">{a.title}</div>
                              <div className="text-sm text-gray-600">{a.company}</div>
                            </button>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span className="flex items-center gap-1" title="Prep steps done">
                                <CheckSquare className="h-3 w-3" /> {done}/{a.checklist.length}
                              </span>
                              {a.nextDate && (
                                <span className="flex items-center gap-1" title={a.nextLabel}>
                                  <CalendarDays className="h-3 w-3" /> {shortDate(a.nextDate)}
                                </span>
                              )}
                            </div>
                            <select
                              aria-label={`Stage for ${a.title} at ${a.company}`}
                              className="w-full rounded border bg-white px-2 py-1 text-xs"
                              value={a.status}
                              onChange={(e) => move(a, e.target.value as AppStatus)}
                            >
                              {[...PIPELINE, ...CLOSED].map((s) => (
                                <option key={s.value} value={s.value}>
                                  {STATUS_LABEL[s.value]}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add an application</DialogTitle>
            <DialogDescription>Tracking is free. The job description unlocks the readiness score and the interview prep kit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-title">Job title</Label>
                <Input id="new-title" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-company">Company</Label>
                <Input id="new-company" maxLength={120} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-url">Job link</Label>
                <Input id="new-url" maxLength={500} placeholder="https://" value={form.job_url} onChange={(e) => setForm({ ...form, job_url: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-location">Location</Label>
                <Input id="new-location" maxLength={120} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-jd">Job description</Label>
              <Textarea
                id="new-jd"
                rows={6}
                maxLength={12000}
                placeholder="Paste the full job posting"
                value={form.job_description}
                onChange={(e) => setForm({ ...form, job_description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={saving || !form.title.trim() || !form.company.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplicationSheet
        app={open}
        onClose={() => select(null)}
        onChange={replace}
        onDelete={(id) => {
          select(null);
          setApps((list) => (list ? list.filter((a) => a.id !== id) : list));
          load();
        }}
      />
    </Layout>
  );
};

export default Applications;
