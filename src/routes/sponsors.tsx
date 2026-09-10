import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { sponsorSupabase } from "@/integrations/supabase/sponsor-client";
import { requestSponsorOtp, verifySponsorOtp } from "@/lib/sponsor.functions";

export const Route = createFileRoute("/sponsors")({
  head: () => ({
    meta: [
      { title: "UW Blueprint Sponsor Sign In" },
      {
        name: "description",
        content:
          "Sponsor sign-in for the UW Blueprint Resume Book. Enter your work email to get a one-time code.",
      },
    ],
  }),
  component: SponsorLoginPage,
});

type Step = "checking" | "email" | "code";

function SponsorLoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("checking");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    sponsorSupabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) navigate({ to: "/sponsor", replace: true });
      else setStep("email");
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestSponsorOtp({ data: { email: email.trim() } });
      setNotice("If this email is registered, a code has been sent. Check your inbox.");
      setCode("");
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    void sendCode();
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await verifySponsorOtp({ data: { email: email.trim(), code } });
      if (!result.ok) {
        setError(result.error);
        setCode("");
        return;
      }
      const { error: sessionError } = await sponsorSupabase.auth.setSession(result.session);
      if (sessionError) throw new Error(sessionError.message);
      navigate({ to: "/sponsor", replace: true });
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

          {step === "email" ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your work email and we'll send you a one-time code.
              </p>
              <form onSubmit={submitEmail} className="mt-8 space-y-4 text-left">
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
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter the 6-digit code we sent to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </p>
              <form onSubmit={submitCode} className="mt-8 space-y-4">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    pattern="^[0-9]*$"
                    value={code}
                    onChange={setCode}
                    disabled={busy}
                    autoFocus
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }, (_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full font-semibold"
                  disabled={busy || code.length !== 6}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => {
                      setStep("email");
                      setError(null);
                      setNotice(null);
                    }}
                    disabled={busy}
                  >
                    Use a different email
                  </button>
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => void sendCode()}
                    disabled={busy}
                  >
                    Resend code
                  </button>
                </div>
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
