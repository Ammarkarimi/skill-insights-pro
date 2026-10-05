import React, { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage } from "@/lib/api";
import { browserTimeZone, EmailPrefs } from "@/lib/emailPrefs";

/** One-time dashboard prompt to turn on reminder emails. Hidden once the user decides either way. */
const EmailOptIn: React.FC = () => {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);

  useEffect(() => {
    api
      .get<EmailPrefs>("/api/account/email-preferences")
      .then((r) => setPrefs(r.data))
      .catch(() => undefined);
  }, []);

  if (!prefs || !prefs.emailEnabled || prefs.decided) return null;

  const decide = async (on: boolean) => {
    try {
      const { data } = await api.put<EmailPrefs>("/api/account/email-preferences", {
        daily: on,
        weekly: on,
        timezone: browserTimeZone(),
        send_hour: 8,
      });
      setPrefs(data);
      toast(on ? { title: "Reminders on", description: "Change the time or turn them off in Settings." } : { title: "No reminders" });
    } catch (err) {
      toast({ title: "Could not save", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <BellRing className="h-6 w-6 text-primary shrink-0" />
        <p className="text-sm flex-1">
          <strong>Want a nudge by email?</strong> One short email at 8am on days you have something to do (an interview, mistakes to
          review, a streak to keep), plus a Monday summary.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => decide(true)}>
            Yes, remind me
          </Button>
          <Button size="sm" variant="ghost" onClick={() => decide(false)}>
            No thanks
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailOptIn;
