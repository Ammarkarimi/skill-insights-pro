import { useState } from "react";
import { MailWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { api, apiErrorMessage } from "@/lib/api";

/** Shown until the email is confirmed: free credits are only added after that. */
const VerifyEmailBanner = () => {
  const { user, pricing } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user || user.emailVerified) return null;

  const resend = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<{ sent: boolean; verified: boolean }>("/api/auth/verify/resend");
      if (data.verified) toast.success("Your email is already confirmed. Refresh the page.");
      else if (data.sent) toast.success(`We sent a new link to ${user.email}.`);
      else toast.error("We could not send the email. Please try again later.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const credits = pricing?.freeSignupCredits;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center">
      <MailWarning className="h-5 w-5 shrink-0" />
      <p className="flex-1">
        Confirm your email to {credits ? `get your ${credits} free credits` : "finish setting up your account"}. We sent
        a link to <strong>{user.email}</strong>.
      </p>
      <Button size="sm" variant="outline" onClick={resend} disabled={busy}>
        Send the link again
      </Button>
    </div>
  );
};

export default VerifyEmailBanner;
