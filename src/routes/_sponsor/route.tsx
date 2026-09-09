import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { sponsorSupabase } from "@/integrations/supabase/sponsor-client";

export const Route = createFileRoute("/_sponsor")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await sponsorSupabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/sponsors" });
    return { sponsorUser: data.user };
  },
  component: () => <Outlet />,
});
