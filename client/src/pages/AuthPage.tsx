import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api";

const AuthPage: React.FC<{ mode: "login" | "register" }> = ({ mode }) => {
  const { login, register, pricing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/home";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isRegister && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (isRegister && !accepted) {
      setError("Please accept the Terms of Service and Privacy Policy.");
      return;
    }
    setSubmitting(true);
    try {
      if (isRegister) await register(email.trim(), password, name.trim());
      else await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <CardHeader className="space-y-2 text-center">
            <Link to="/" className="text-2xl font-bold text-primary">
              Skill Sphere
            </Link>
            <CardTitle className="text-xl">{isRegister ? "Create your account" : "Welcome back"}</CardTitle>
            <CardDescription>
              {isRegister
                ? `Get ${pricing?.freeSignupCredits ?? 10} free credits to try every feature.`
                : "Sign in to continue your career journey."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={isRegister ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
              {isRegister && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
            </div>
            {isRegister && (
              <label className="flex items-start gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" className="text-primary underline" target="_blank">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-primary underline" target="_blank">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRegister ? "Create account" : "Sign in"}
            </Button>
            <p className="text-sm text-gray-600">
              {isRegister ? "Already have an account? " : "New to Skill Sphere? "}
              <Link to={isRegister ? "/login" : "/register"} state={location.state} className="text-primary underline">
                {isRegister ? "Sign in" : "Create one"}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AuthPage;
