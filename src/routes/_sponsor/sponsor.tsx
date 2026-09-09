import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sponsorSupabase } from "@/integrations/supabase/sponsor-client";
import { useSponsorSession, useSponsorSignOut } from "@/lib/sponsor-session";

export const Route = createFileRoute("/_sponsor/sponsor")({
  head: () => ({
    meta: [{ title: "Sponsor Portal — UW Blueprint Resume Book" }],
  }),
  component: SponsorPortalPage,
});

/** How often to check whether the hour-long sponsor session has lapsed. */
const SESSION_CHECK_MS = 60 * 1000;

function SponsorPortalPage() {
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
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <img src="/blueprint-logo.png" alt="UW Blueprint" className="mb-6 h-16 w-16" />
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        Sponsor Portal
      </p>
      <h1 className="mt-3 text-3xl font-extrabold text-foreground">
        Signed in as {data?.sponsor.name}
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        Your resume view is coming soon. For now, this just confirms your sponsor login worked.
      </p>
      <Button variant="outline" className="mt-8" onClick={() => void signOut()}>
        Sign out
      </Button>
    </main>
  );
}
