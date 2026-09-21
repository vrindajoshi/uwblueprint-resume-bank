import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { FileText, Gift, Loader2, Users2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sponsorSupabase } from "@/integrations/supabase/sponsor-client";
import { sponsorSessionQuery, useSponsorSession, useSponsorSignOut } from "@/lib/sponsor-session";
import { sponsorConfirmPasswordChanged } from "@/lib/sponsor.functions";

export const Route = createFileRoute("/_sponsor/sponsor")({
  head: () => ({
    meta: [{ title: "Sponsor Portal — UW Blueprint Resume Book" }],
  }),
  component: SponsorLayout,
});

/** How often to check whether the hour-long sponsor session has lapsed. */
const SESSION_CHECK_MS = 60 * 1000;

const TABS = [
  { to: "/sponsor/resumes", label: "Resumes", icon: FileText },
  { to: "/sponsor/members", label: "Members", icon: Users2 },
  { to: "/sponsor/perks", label: "Perks", icon: Gift },
] as const;

function SponsorLayout() {
  const { data, isLoading, isError } = useSponsorSession();
  const signOut = useSponsorSignOut();

  // The sponsor client never auto-refreshes, so the access token itself hard-expires
  // ~1 hour after login. This just makes sure someone idling on the page is bounced
  // back to /sponsors promptly instead of only on their next navigation.
  useEffect(() => {
    const interval = setInterval(() => {
      sponsorSupabase.auth.getSession().then(({ data: sessionData }) => {
        const expiresAt = sessionData.session?.expires_at;
        if (!expiresAt || expiresAt * 1000 <= Date.now()) void signOut();
      });
    }, SESSION_CHECK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isError) void signOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError]);

  if (isLoading || isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data?.mustChangePassword) {
    return <SetPasswordGate onSignOut={signOut} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        {...(data?.email ? { email: data.email } : {})}
        subtitle={data ? `Sponsor Portal · ${data.sponsor.name}` : "Sponsor Portal"}
        onSignOut={signOut}
      />
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <nav className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-24 space-y-1">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className="flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{
                  className:
                    "flex items-center gap-2.5 rounded-sm !bg-transparent px-3 py-2 text-sm !font-bold !text-[#173b7a] transition-colors",
                }}
                activeOptions={{ exact: false }}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="flex flex-1 flex-col">
          <nav className="mb-6 flex gap-2 md:hidden">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground"
                activeProps={{
                  className:
                    "rounded-lg border border-border !bg-transparent px-3 py-2 text-sm !font-bold !text-[#173b7a]",
                }}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/** Blocks the portal until a sponsor signed in with an admin-issued temp password sets their own. */
function SetPasswordGate({ onSignOut }: { onSignOut: () => void }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Client-side self-update -- keeps the current session valid, unlike
      // going through the admin API (see sponsorConfirmPasswordChanged).
      const { error: updateError } = await sponsorSupabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);

      const { data: sessionData } = await sponsorSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) await sponsorConfirmPasswordChanged({ data: { accessToken } });

      await queryClient.invalidateQueries({ queryKey: sponsorSessionQuery.queryKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="panel px-8 py-10 text-center">
          <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You're signed in with a temporary password. Choose your own before continuing.
          </p>
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
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set password"}
            </Button>
          </form>
          {error ? (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={onSignOut}
            disabled={busy}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
