import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Loader2, Plus, Sparkles } from "lucide-react";
import Layout from "@/components/Layout";
import CostNote from "@/components/CostNote";
import FileUpload from "@/components/FileUpload";
import DrillTab from "@/components/stories/DrillTab";
import StoryEditor, { StoryItem } from "@/components/stories/StoryEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Coverage {
  theme: string;
  label: string;
  count: number;
}

const StoryBank: React.FC = () => {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "drill" ? "drill" : "stories");
  const [stories, setStories] = useState<StoryItem[] | null>(null);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [themes, setThemes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"" | "draft" | "new">("");

  const load = () =>
    api
      .get<{ stories: StoryItem[]; coverage: Coverage[]; themes: Record<string, string> }>("/api/stories")
      .then((r) => {
        setStories(r.data.stories);
        setCoverage(r.data.coverage);
        setThemes(r.data.themes);
        setSelected((cur) => cur ?? r.data.stories[0]?.id ?? null);
      })
      .catch((err) => {
        setStories([]);
        toast({ title: "Could not load your stories", description: apiErrorMessage(err), variant: "destructive" });
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draftFromResume = async () => {
    if (!file) return;
    setBusy("draft");
    try {
      const form = new FormData();
      form.append("resume", file);
      const { data } = await api.post<{ stories: StoryItem[] }>("/api/stories/draft", form);
      await load();
      setSelected(data.stories[0]?.id ?? null);
      toast({ title: `${data.stories.length} stories drafted`, description: "Fill in the [placeholders], then ask for a critique." });
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not draft stories", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const addBlank = async () => {
    setBusy("new");
    try {
      const { data } = await api.post<StoryItem>("/api/stories", { title: "New story" });
      // Show the new story's editor at once, so nothing typed lands in the previous story.
      setStories((list) => [data, ...(list ?? [])]);
      setSelected(data.id);
      load();
    } catch (err) {
      toast({ title: "Could not add a story", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const current = stories?.find((s) => s.id === selected) ?? null;
  const gaps = coverage.filter((c) => c.count === 0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <h1 className="page-header">Story Bank</h1>
        <p className="text-gray-600 -mt-4 mb-6">
          Prepare STAR stories (Situation, Task, Action, Result) for behavioral interviews, then drill them out loud.
        </p>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="stories">My stories</TabsTrigger>
            <TabsTrigger value="drill">Drill</TabsTrigger>
          </TabsList>

          <TabsContent value="stories" className="space-y-6">
            {stories === null ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Theme coverage</CardTitle>
                    <CardDescription>
                      {gaps.length === 0
                        ? "Every common theme has at least one story. Strengthen the weakest with a critique."
                        : `${gaps.length} common interview themes have no story yet. Interviewers will ask about them.`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {coverage.map((c) => (
                      <span
                        key={c.theme}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs",
                          c.count ? "bg-green-50 border-green-200 text-green-800" : "border-dashed text-gray-500",
                        )}
                      >
                        {c.label} · {c.count}
                      </span>
                    ))}
                  </CardContent>
                </Card>

                <div className="grid lg:grid-cols-[320px_1fr] gap-6">
                  <div className="space-y-3">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" /> Draft from your resume
                        </CardTitle>
                        <CardDescription>Only facts from your resume are used. Gaps become [placeholders] for you to fill.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <FileUpload onFilesChange={(f) => setFile(f[0] ?? null)} busy={busy === "draft"} busyLabel="Drafting stories..." />
                        <div className="flex items-center gap-2">
                          <Button onClick={draftFromResume} disabled={!file || busy !== ""}>
                            {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                            Draft stories
                          </Button>
                          <CostNote action="story_draft" />
                        </div>
                      </CardContent>
                    </Card>
                    <Button variant="outline" className="w-full" onClick={addBlank} disabled={busy !== ""}>
                      <Plus className="h-4 w-4 mr-1" /> Write a story yourself
                    </Button>
                    <nav aria-label="Your stories" className="space-y-2">
                      {stories.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelected(s.id)}
                          aria-current={s.id === selected}
                          className={cn("w-full rounded-lg border bg-white p-3 text-left", s.id === selected ? "border-primary ring-1 ring-primary" : "hover:bg-gray-50")}
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-medium text-sm">{s.title}</span>
                            {s.score !== null && <Badge variant="secondary">{s.score}</Badge>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {s.themes.map((t) => (
                              <span key={t} className="text-[11px] text-gray-500">
                                #{themes[t] ?? t}
                              </span>
                            ))}
                            {s.placeholders > 0 && <span className="text-[11px] text-amber-700">· {s.placeholders} to fill</span>}
                          </div>
                        </button>
                      ))}
                    </nav>
                  </div>
                  <div className="min-w-0">
                    {current ? (
                      <StoryEditor
                        key={current.id}
                        story={current}
                        themes={themes}
                        onSaved={() => load()}
                        onDeleted={() => {
                          setSelected(null);
                          load();
                        }}
                      />
                    ) : (
                      <Card>
                        <CardContent className="py-16 text-center text-gray-600">
                          Draft stories from your resume, or write one yourself. Five to eight good stories cover most behavioral interviews.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="drill" className="max-w-3xl">
            <DrillTab stories={stories ?? []} themes={themes} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default StoryBank;
