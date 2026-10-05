import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { api, apiErrorMessage } from "@/lib/api";

const Shell: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <Link to="/" className="text-2xl font-bold text-primary">
          Skill Sphere
        </Link>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children}
    </Card>
  </div>
);

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/api/auth/forgot", { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Shell title="Check your email" description="If an account exists for that address, a reset link is on its way.">
        <CardContent className="space-y-3 text-center text-sm text-gray-600">
          <MailCheck className="h-10 w-10 mx-auto text-primary" />
          <p>The link works once and expires in 30 minutes. Check your spam folder if it does not arrive.</p>
        </CardContent>
        <CardFooter className="justify-center">
          <Link to="/login" className="text-primary underline text-sm">
            Back to sign in
          </Link>
        </CardFooter>
      </Shell>
    );
  }

  return (
    <Shell title="Forgot your password?" description="Enter your email and we will send you a link to choose a new one.">
      <form onSubmit={submit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input id="forgot-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset link
          </Button>
          <Link to="/login" className="text-primary underline text-sm">
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Shell>
  );
};

export const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      await api.post("/api/auth/reset", { token, password });
      await refresh();
      navigate("/home", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <Shell title="Link incomplete" description="Open the full link from your email, or request a new one.">
        <CardFooter className="justify-center">
          <Button asChild>
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </CardFooter>
      </Shell>
    );
  }

  return (
    <Shell title="Choose a new password" description="You will be signed in afterwards, and signed out everywhere else.">
      <form onSubmit={submit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}{" "}
                {/expired|used/.test(error) && (
                  <Link to="/forgot-password" className="underline">
                    Request a new link
                  </Link>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input id="confirm-password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save and sign in
          </Button>
        </CardFooter>
      </form>
    </Shell>
  );
};

export const Unsubscribe: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"ask" | "busy" | "done" | "error">("ask");

  const confirm = async () => {
    setState("busy");
    try {
      await api.post("/api/email/unsubscribe", { token });
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <Shell
      title={state === "done" ? "You are unsubscribed" : "Stop reminder emails?"}
      description={
        state === "done"
          ? "You will not get daily or weekly reminders any more. You can turn them back on in Settings."
          : "This turns off daily nudges and weekly summaries. Account emails, such as password resets, still arrive."
      }
    >
      <CardFooter className="flex flex-col gap-3">
        {state === "done" ? (
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        ) : (
          <Button onClick={confirm} disabled={state === "busy" || !token} className="w-full">
            {state === "busy" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Unsubscribe
          </Button>
        )}
        {state === "error" && <p className="text-sm text-red-600">This link is not valid. Change your reminders in Settings instead.</p>}
        <Link to="/settings" className="text-primary underline text-sm">
          Email settings
        </Link>
      </CardFooter>
    </Shell>
  );
};
