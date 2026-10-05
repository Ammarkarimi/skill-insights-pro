import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import CostNote from "@/components/CostNote";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface Critique {
  parts: Record<Part, { score: number; feedback: string }>;
  overallScore: number;
  ownership: string;
  quantified: boolean;
  strengths: string[];
  improvements: string[];
  rewrite: Record<Part, string>;
  rewriteWarnings: string[];
  followUps: string[];
  stale?: boolean;
}

export interface StoryItem {
  id: number;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  themes: string[];
  origin: "draft" | "manual";
  coaching: { questions?: string[]; warnings?: string[] };
  critique: Critique | null;
  score: number | null;
  spokenSeconds: number;
  placeholders: number;
}

type Part = "situation" | "task" | "action" | "result";
const PARTS: { key: Part; label: string; hint: string }[] = [
  { key: "situation", label: "Situation", hint: "Brief context: where, when, what was at stake (1-2 sentences)" },
  { key: "task", label: "Task", hint: "Your goal or responsibility" },
  { key: "action", label: "Action", hint: "What you personally did, step by step. Say 'I', not 'we'" },
  { key: "result", label: "Result", hint: "The measured outcome, and what you learned" },
];
const PLACEHOLDER = /\[[^\]]{1,40}\]/g;

interface Props {
  story: StoryItem;
  themes: Record<string, string>;
  onSaved: (s: StoryItem) => void;
  onDeleted: (id: number) => void;
}

const StoryEditor: React.FC<Props> = ({ story, themes, onSaved, onDeleted }) => {
  const { toast } = useToast();
  const [draft, setDraft] = useState(story);
  const [busy, setBusy] = useState<"" | "save" | "critique" | "delete">("");

  useEffect(() => setDraft(story), [story]);

  const dirty = (["title", ...PARTS.map((p) => p.key)] as (keyof StoryItem)[]).some((k) => draft[k] !== story[k]) ||
    draft.themes.join() !== story.themes.join();
  const placeholders = PARTS.flatMap((p) => draft[p.key].match(PLACEHOLDER) ?? []);
  const seconds = Math.round(PARTS.reduce((n, p) => n + draft[p.key].split(/\s+/).filter(Boolean).length, 0) / 2.5);
  const c = story.critique;

  const fail = (title: string, err: unknown) => {
    if (!isInsufficientCredits(err)) toast({ title, description: apiErrorMessage(err), variant: "destructive" });
  };

  const save = async (): Promise<StoryItem | null> => {
    setBusy("save");
    try {
      const { data } = await api.patch<StoryItem>(`/api/stories/${story.id}`, {
        title: draft.title,
        situation: draft.situation,
        task: draft.task,
        action: draft.action,
        result: draft.result,
        themes: draft.themes,
      });
      onSaved(data);
      return data;
    } catch (err) {
      fail("Could not save the story", err);
      return null;
    } finally {
      setBusy("");
    }
  };

  const critique = async () => {
    if (dirty && !(await save())) return;
    setBusy("critique");
    try {
      const { data } = await api.post<StoryItem>(`/api/stories/${story.id}/critique`);
      onSaved(data);
    } catch (err) {
      fail("Could not critique the story", err);
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${story.title}"?`)) return;
    setBusy("delete");
    try {
      await api.delete(`/api/stories/${story.id}`);
      onDeleted(story.id);
    } catch (err) {
      fail("Could not delete", err);
      setBusy("");
    }
  };

  const toggleTheme = (key: string) =>
    setDraft((d) => ({
      ...d,
      themes: d.themes.includes(key) ? d.themes.filter((t) => t !== key) : d.themes.length < 3 ? [...d.themes, key] : d.themes,
    }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="story-title">Title</Label>
            <Input id="story-title" value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Themes (up to 3)</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(themes).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleTheme(key)}
                  aria-pressed={draft.themes.includes(key)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs",
                    draft.themes.includes(key) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-gray-100",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {story.coaching.questions && story.coaching.questions.length > 0 && placeholders.length > 0 && (
            <Alert>
              <AlertDescription>
                <p className="font-medium mb-1">Fill in the [placeholders]. Ask yourself:</p>
                <ul className="list-disc pl-5 text-sm">
                  {story.coaching.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {story.coaching.warnings?.map((w) => (
            <Alert key={w} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{w}</AlertDescription>
            </Alert>
          ))}
          {PARTS.map((p) => (
            <div key={p.key} className="space-y-1">
              <Label htmlFor={`story-${p.key}`}>
                {p.label} <span className="font-normal text-gray-500">· {p.hint}</span>
              </Label>
              <Textarea
                id={`story-${p.key}`}
                rows={p.key === "action" ? 4 : 2}
                maxLength={2000}
                value={draft[p.key]}
                onChange={(e) => setDraft({ ...draft, [p.key]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span className={cn(seconds > 150 && "text-amber-700")}>
              About {seconds}s to say{seconds > 150 ? " (aim for 90-120s)" : ""}
            </span>
            {placeholders.length > 0 && (
              <span className="text-amber-700">
                {placeholders.length} placeholder{placeholders.length === 1 ? "" : "s"} to fill: {placeholders.slice(0, 4).join(", ")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={!dirty || busy !== "" || !draft.title.trim()}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
            <Button variant="outline" onClick={critique} disabled={busy !== ""}>
              {busy === "critique" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {c ? "Critique again" : "Critique this story"}
            </Button>
            <CostNote action="story_critique" />
            <Button variant="ghost" className="ml-auto text-red-600" onClick={remove} disabled={busy !== ""}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {c && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              Coach's critique · {c.overallScore}/100
              {c.stale && <Badge variant="outline">Story changed since</Badge>}
            </CardTitle>
            <CardDescription>{c.ownership}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-3">
              {PARTS.map((p) => (
                <div key={p.key}>
                  <div className="flex justify-between">
                    <span className="font-medium">{p.label}</span>
                    <span>{c.parts[p.key].score}/10</span>
                  </div>
                  <Progress value={c.parts[p.key].score * 10} className="h-1.5" />
                  <p className="text-xs text-gray-600 mt-1">{c.parts[p.key].feedback}</p>
                </div>
              ))}
            </div>
            <p className="flex items-center gap-2">
              {c.quantified ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
              {c.quantified ? "The result is measured." : "The result has no number yet. Interviewers will ask for one."}
            </p>
            {c.improvements.length > 0 && (
              <div>
                <h4 className="font-semibold">Improve next</h4>
                <ol className="list-decimal pl-5">
                  {c.improvements.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
              </div>
            )}
            <div className="rounded-md bg-gray-50 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Tighter version</h4>
                <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, ...c.rewrite })}>
                  <Wand2 className="h-3 w-3 mr-1" /> Use this
                </Button>
              </div>
              {PARTS.map((p) => (
                <p key={p.key}>
                  <strong>{p.label[0]}:</strong> {c.rewrite[p.key]}
                </p>
              ))}
              {c.rewriteWarnings.map((w) => (
                <p key={w} className="text-xs text-red-700">
                  {w}
                </p>
              ))}
            </div>
            <div>
              <h4 className="font-semibold">Be ready for these follow-ups</h4>
              <ul className="list-disc pl-5">
                {c.followUps.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StoryEditor;
