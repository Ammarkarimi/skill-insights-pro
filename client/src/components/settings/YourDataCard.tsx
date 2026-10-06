import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage } from "@/lib/api";

/** Download everything we store, or delete the account (data rights under GDPR and similar laws). */
const YourDataCard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const download = async () => {
    setExporting(true);
    try {
      const { data, headers } = await api.get<Blob>("/api/account/export", { responseType: "blob" });
      const name = /filename="([^"]+)"/.exec(headers["content-disposition"] ?? "")?.[1] ?? "my-data.json";
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Could not export your data", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDeleting(true);
    try {
      await api.post("/api/account/delete", { password, confirm });
      await logout();
      navigate("/", { replace: true });
      toast({ title: "Your account was deleted" });
    } catch (err) {
      setError(apiErrorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data</CardTitle>
        <CardDescription>Download a copy of everything stored about you, or delete your account.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" onClick={download} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Download my data
        </Button>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setPassword("");
              setConfirm("");
              setError("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-2" /> Delete my account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={remove} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  This permanently deletes your profile, practice history, stories, applications and portfolio.
                  {user &&
                    user.credits > 0 &&
                    ` Your ${user.credits} remaining credits are lost. If you want a refund for an unused pack, ask us before deleting.`}{" "}
                  Payment records are kept without your details, because tax law requires it. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="delete-password">Your password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
                <Input id="delete-confirm" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={deleting || !password || confirm.trim().toUpperCase() !== "DELETE"}
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete forever
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default YourDataCard;
