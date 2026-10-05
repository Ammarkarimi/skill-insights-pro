import React, { useEffect, useState } from "react";
import { Copy, ExternalLink, Globe, Linkedin, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage } from "@/lib/api";

interface Settings {
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  isPublished: boolean;
  allowIndexing: boolean;
  proofIds: number[];
  reviewIds: number[];
  showGithub: boolean;
  showReadiness: boolean;
  publicUrl: string | null;
}
interface Data {
  settings: Settings;
  proofs: { id: number; skill: string; level: string; proficiency: number; completedAt: string }[];
  reviews: { id: number; repo: string; overallScore: number; ownership: string }[];
}

const PortfolioSettings: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Data>("/api/portfolio")
      .then((r) => {
        setData(r.data);
        setForm(r.data.settings);
      })
      .catch((err) => toast({ title: "Could not load your portfolio", description: apiErrorMessage(err), variant: "destructive" }));
  }, [refreshKey, toast]);

  if (!data || !form) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm({ ...form, [key]: value });
  const toggle = (key: "proofIds" | "reviewIds", id: number) =>
    set(key, form[key].includes(id) ? form[key].filter((x) => x !== id) : [...form[key], id]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: saved } = await api.put<Settings>("/api/portfolio", { ...form, slug: form.slug.trim().toLowerCase() });
      setForm(saved);
      toast({ title: saved.isPublished ? "Portfolio published" : "Portfolio saved" });
    } catch (err) {
      toast({ title: "Could not save", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const url = form.publicUrl ?? `${window.location.origin}/p/${form.slug}`;
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast({ title: "Copied" }));
  const selectedSkills = Array.from(new Set(data.proofs.filter((p) => form.proofIds.includes(p.id)).map((p) => p.skill)));
  const badgeUrl = (skill: string) =>
    `${url.replace(/\/p\/[^/]+$/, "")}/api/public/portfolio/${form.slug}/badge.svg?skill=${encodeURIComponent(skill)}`;
  const badgeSnippet = (skill: string) => `[![${skill} proof](${badgeUrl(skill)})](${url})`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Your public portfolio</CardTitle>
          <CardDescription>A shareable page with your proven skills and reviewed projects. Only what you select is shown.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="pf-slug">Link name</Label>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">/p/</span>
                <Input id="pf-slug" value={form.slug} maxLength={40} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pf-name">Display name</Label>
              <Input id="pf-name" value={form.displayName} maxLength={120} onChange={(e) => set("displayName", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pf-headline">Headline</Label>
            <Input id="pf-headline" value={form.headline} maxLength={160} placeholder="e.g. Backend engineer · Python, AWS" onChange={(e) => set("headline", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pf-bio">About</Label>
            <Textarea id="pf-bio" rows={3} value={form.bio} maxLength={1500} onChange={(e) => set("bio", e.target.value)} />
          </div>

          <div>
            <h3 className="font-semibold mb-2">Skill proofs to show</h3>
            {data.proofs.length === 0 ? (
              <p className="text-sm text-gray-500">Complete a skill proof first.</p>
            ) : (
              <div className="space-y-2">
                {data.proofs.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 text-sm cursor-pointer">
                    <Checkbox checked={form.proofIds.includes(p.id)} onCheckedChange={() => toggle("proofIds", p.id)} />
                    <span className="font-medium">{p.skill}</span>
                    <Badge variant="secondary">{p.level}</Badge>
                    <span className="text-gray-500">
                      {p.proficiency} · {new Date(p.completedAt).toLocaleDateString()}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold mb-2">Projects to show</h3>
            {data.reviews.length === 0 ? (
              <p className="text-sm text-gray-500">Review a GitHub project first.</p>
            ) : (
              <div className="space-y-2">
                {data.reviews.map((r) => (
                  <label key={r.id} className="flex items-center gap-3 text-sm cursor-pointer">
                    <Checkbox checked={form.reviewIds.includes(r.id)} onCheckedChange={() => toggle("reviewIds", r.id)} />
                    <span className="font-medium">{r.repo}</span>
                    <span className="text-gray-500">{r.overallScore}/100</span>
                    {r.ownership === "not_verified" && <span className="text-xs text-amber-600">ownership not verified</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3 border-t pt-4">
            {(
              [
                ["showGithub", "Show my GitHub profile"],
                ["showReadiness", "Show my readiness score for my target role"],
              ] as const
            ).map(([key, text]) => (
              <label key={key} className="flex items-center justify-between text-sm">
                {text}
                <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
              </label>
            ))}
            <label className="flex items-center justify-between text-sm">
              <span>
                <strong>Publish</strong>: anyone with the link can view it
              </span>
              <Switch checked={form.isPublished} onCheckedChange={(v) => set("isPublished", v)} />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Globe className="h-4 w-4" /> Allow search engines to list it
              </span>
              <Switch checked={form.allowIndexing} onCheckedChange={(v) => set("allowIndexing", v)} disabled={!form.isPublished} />
            </label>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={save} disabled={saving || form.slug.length < 3}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </CardFooter>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Share</CardTitle>
          <CardDescription>{form.isPublished && form.publicUrl ? "Your portfolio is live." : "Publish and save to get a shareable link."}</CardDescription>
        </CardHeader>
        {form.isPublished && form.publicUrl && (
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2">
              <Input readOnly value={form.publicUrl} className="text-xs" />
              <Button size="icon" variant="outline" onClick={() => copy(form.publicUrl!)} title="Copy link">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={form.publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" /> Open
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(form.publicUrl)}`} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="mr-1 h-4 w-4" /> Share on LinkedIn
                </a>
              </Button>
            </div>
            {selectedSkills.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">Badges for your README</p>
                {selectedSkills.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <img src={badgeUrl(s)} alt={`${s} badge`} />
                    <Button size="sm" variant="ghost" onClick={() => copy(badgeSnippet(s))}>
                      <Copy className="h-3 w-3 mr-1" /> Markdown
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default PortfolioSettings;
