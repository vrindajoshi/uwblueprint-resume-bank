import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sponsorSupabase } from "@/integrations/supabase/sponsor-client";
import { sponsorConfirmPasswordChanged } from "@/lib/sponsor.functions";

export const Route = createFileRoute("/sponsors/reset-password")({
  head: () => ({
    meta: [{ title: "Reset Sponsor Password — UW Blueprint" }],
  }),
  component: ResetPasswordPage,
});

type Step = "checking" | "ready" | "invalid" | "done";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase consumes the recovery token from the URL hash on load and fires
  // PASSWORD_RECOVERY once that session is established. Fall back to a plain
  // getSession() check in case the event fired before this listener attached.
  useEffect(() => {
    let active = true;

    const { data: listener } = sponsorSupabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setStep("ready");
    });

    sponsorSupabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setStep((current) =>
        current === "checking" ? (data.session ? "ready" : "invalid") : current,
      );
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await sponsorSupabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);

      // Defensive: covers a sponsor who never completed the forced first
      // password change and instead reset via this flow directly.
      const { data: sessionData } = await sponsorSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) await sponsorConfirmPasswordChanged({ data: { accessToken } });

      setStep("done");
      setTimeout(() => navigate({ to: "/sponsor", replace: true }), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="panel px-8 py-10 text-center">
          <img src="/blueprint-logo.png" alt="UW Blueprint" className="mx-auto mb-6 h-16 w-16" />
          <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>

          {step === "checking" ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {step === "invalid" ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                This reset link is invalid or has expired.
              </p>
              <Link
                to="/sponsors"
                className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Back to sign in
              </Link>
            </>
          ) : null}

          {step === "done" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Password updated. Taking you to the sponsor portal...
            </p>
          ) : null}

          {step === "ready" ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">Choose a new password.</p>
              <form onSubmit={submit} className="mt-8 space-y-4 text-left">
                <Input
                  type="password"
                  required
                  autoFocus
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <Input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                />
                <Button type="submit" size="lg" className="w-full font-semibold" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set new password"}
                </Button>
              </form>
            </>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
