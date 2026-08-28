import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapSession } from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UW Blueprint Sponsor Resume Book" },
      {
        name: "description",
        content:
          "Sign in with your uwblueprint.org Google account to manage your resumes and profile.",
      },
      { property: "og:title", content: "UW Blueprint Sponsor Resume Book" },
      {
        property: "og:description",
        content: "Resume collection platform for UW Blueprint members and recruiting leads.",
      },
    ],
  }),
  component: LoginPage,
});

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.45a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.15 3.58-8.79Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.86-3c-1.08.72-2.45 1.15-4.08 1.15-3.13 0-5.79-2.11-6.74-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.26 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.28a12 12 0 0 0 0 10.73l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.63l3.98 3.1C6.21 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const routeIn = async () => {
    try {
      const info = await bootstrapSession();
      if (info.isAdmin) navigate({ to: "/admin/members", replace: true });
      else if (info.needsOnboarding) navigate({ to: "/onboarding", replace: true });
      else navigate({ to: "/profile", replace: true });
    } catch (e) {
      await supabase.auth.signOut();
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setBusy(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) void routeIn();
      else setChecking(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { hd: "uwblueprint.org", prompt: "select_account" },
      },
    });
    if (signInError) {
      setError(signInError.message ?? "Could not start Google sign-in.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="panel px-8 py-10 text-center">
          <img
            src="public/blueprint-logo.png"
            alt="UW Blueprint"
            className="mx-auto mb-6 h-16 w-16"
          />
          <h1 className="text-2xl font-bold text-foreground">UW Blueprint Sponsor Resume Book</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your <span className="font-medium text-foreground">uwblueprint.org</span>{" "}
            Google account, and share your resume with sponsors.
          </p>

          <Button
            onClick={signIn}
            disabled={busy || checking}
            variant="outline"
            size="lg"
            className="mt-8 w-full gap-3 font-semibold"
          >
            {busy || checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
            Sign in with Google
          </Button>

          {error ? (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          For UW Blueprint members only.
        </p>
      </div>
    </main>
  );
}
