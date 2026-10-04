import React, { useState } from "react";
import { Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FileUpload from "@/components/FileUpload";
import CostNote from "@/components/CostNote";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";
import { invalidateReadiness, TargetRole } from "@/lib/readiness";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (target: TargetRole) => void;
}

const TargetRoleWizard: React.FC<Props> = ({ open, onOpenChange, onCreated }) => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("job_description", jd.trim());
      if (resume) form.append("resume", resume);
      const { data } = await api.post<TargetRole>("/api/readiness/targets", form);
      invalidateReadiness();
      onCreated(data);
      onOpenChange(false);
      setTitle("");
      setJd("");
      setResume(null);
      toast({ title: "Target role set", description: `Found ${data.requirements.length} requirements for ${data.title}.` });
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not set target role", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Set your target role
          </DialogTitle>
          <DialogDescription>
            We turn the role into a hiring scorecard. Every assessment, resume review and interview then counts towards
            your readiness score.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-title">Job title</Label>
            <Input id="target-title" placeholder="e.g. Senior Frontend Engineer" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target-jd">Job description (recommended)</Label>
            <Textarea
              id="target-jd"
              placeholder="Paste a real job posting for the most accurate requirements"
              className="min-h-[120px]"
              value={jd}
              maxLength={12000}
              onChange={(e) => setJd(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Resume (optional)</Label>
            <p className="text-xs text-gray-500">Gives you a starting score straight away. The file is not stored.</p>
            <FileUpload onFilesChange={(files) => setResume(files[0] ?? null)} busy={saving} busyLabel="Building your scorecard..." />
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row sm:items-center gap-3">
          <CostNote action="target_role_setup" />
          <Button onClick={submit} disabled={saving || title.trim().length < 2}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Building scorecard..." : "Create scorecard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TargetRoleWizard;
