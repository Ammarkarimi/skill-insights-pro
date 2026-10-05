import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, Send } from "lucide-react";
import Layout from "@/components/Layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage } from "@/lib/api";
import { browserTimeZone, EmailPrefs, hourLabel, timeZones } from "@/lib/emailPrefs";

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "test">("");

  useEffect(() => {
    api
      .get<EmailPrefs>("/api/account/email-preferences")
      .then((r) => setPrefs(r.data.decided ? r.data : { ...r.data, timezone: browserTimeZone() }))
      .catch(() => undefined);
  }, []);

  const save = async (next: EmailPrefs) => {
    setPrefs(next);
    setBusy("save");
    try {
      const { data } = await api.put<EmailPrefs>("/api/account/email-preferences", {
        daily: next.daily,
        weekly: next.weekly,
        timezone: next.timezone,
        send_hour: next.sendHour,
      });
      setPrefs(data);
      toast({ title: "Email settings saved" });
    } catch (err) {
      toast({ title: "Could not save", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const sendTest = async () => {
    setBusy("test");
    try {
      await api.post("/api/account/test-email");
      toast({ title: "Test email sent", description: `Check ${user?.email}. If it is not there, look in spam.` });
    } catch (err) {
      toast({ title: "Could not send", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="page-header mb-1">Settings</h1>
          <p className="text-gray-600">Signed in as {user?.email}.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Email reminders
            </CardTitle>
            <CardDescription>
              Short, useful emails only. The daily nudge is skipped on days with nothing to do, and every email has a one-click unsubscribe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {prefs && !prefs.emailEnabled && (
              <Alert>
                <AlertDescription>Email is not set up on this site yet, so reminders will not be sent for now.</AlertDescription>
              </Alert>
            )}
            {!prefs ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor="daily">Daily nudge</Label>
                    <p className="text-sm text-gray-600">Interviews or deadlines today and tomorrow, mistakes to review, and your streak.</p>
                  </div>
                  <Switch id="daily" checked={prefs.daily} disabled={busy !== ""} onCheckedChange={(v) => save({ ...prefs, daily: v })} />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor="weekly">Monday summary</Label>
                    <p className="text-sm text-gray-600">Practice days, readiness change and what to focus on this week.</p>
                  </div>
                  <Switch id="weekly" checked={prefs.weekly} disabled={busy !== ""} onCheckedChange={(v) => save({ ...prefs, weekly: v })} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="send-hour">Send at</Label>
                    <select
                      id="send-hour"
                      className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                      value={prefs.sendHour}
                      disabled={busy !== ""}
                      onChange={(e) => save({ ...prefs, sendHour: Number(e.target.value) })}
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>
                          {hourLabel(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="time-zone">Time zone</Label>
                    <select
                      id="time-zone"
                      className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                      value={prefs.timezone}
                      disabled={busy !== ""}
                      onChange={(e) => save({ ...prefs, timezone: e.target.value })}
                    >
                      {timeZones(prefs.timezone).map((z) => (
                        <option key={z} value={z}>
                          {z.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button variant="outline" onClick={sendTest} disabled={busy !== ""}>
                  {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Send me a test email
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Forgot or want to change your password? <Link to="/forgot-password" className="text-primary underline">Send a reset link</Link>.
            </p>
            <p>
              Credits and purchases are on the <Link to="/billing" className="text-primary underline">Billing</Link> page.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;
