import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sponsorSupabase } from "@/integrations/supabase/sponsor-client";
import { resetSponsorShuffleSeed } from "@/lib/sponsor-session";

export const Route = createFileRoute("/sponsors")({
  head: () => ({
    meta: [
      { title: "UW Blueprint Sponsor Sign In" },
      {
        name: "description",
        content: "Sponsor sign-in for the UW Blueprint Resume Book.",
      },
    ],
  }),
  component: SponsorLoginPage,
});

type Step = "checking" | "sign-in" | "forgot-password";

function SponsorLoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    sponsorSupabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) navigate({ to: "/sponsor", replace: true });
      else setStep("sign-in");
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await sponsorSupabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw new Error("Incorrect email or password.");
      // New login -- give this sponsor session its own randomized resume order.
      resetSponsorShuffleSeed();
      navigate({ to: "/sponsor", replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendResetLink = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sponsorSupabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/sponsors/reset-password`,
      });
      setNotice("If this email is registered, a reset link has been sent. Check your inbox.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (step === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="panel px-8 py-10 text-center">
          <img src="/blueprint-logo.png" alt="UW Blueprint" className="mx-auto mb-6 h-16 w-16" />
          <h1 className="text-2xl font-bold text-foreground">Sponsor Sign In</h1>

          {step === "sign-in" ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in with the email and password your UW Blueprint contact gave you.
              </p>
              <form onSubmit={signIn} className="mt-8 space-y-4 text-left">
                <Input
                  type="email"
                  required
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
                <Input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full font-semibold"
                  disabled={busy || !email.trim() || !password}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
                <button
                  type="button"
                  className="block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setStep("forgot-password");
                    setError(null);
                    setNotice(null);
                  }}
                  disabled={busy}
                >
                  Forgot password?
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <form onSubmit={sendResetLink} className="mt-8 space-y-4 text-left">
                <Input
                  type="email"
                  required
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full font-semibold"
                  disabled={busy || !email.trim()}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
                </Button>
                <button
                  type="button"
                  className="block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setStep("sign-in");
                    setError(null);
                    setNotice(null);
                  }}
                  disabled={busy}
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}

          {error ? (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : notice ? (
            <p className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          For UW Blueprint sponsor contacts only.
        </p>
      </div>
    </main>
  );
}
