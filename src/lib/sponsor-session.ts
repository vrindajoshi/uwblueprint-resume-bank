import { queryOptions, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { sponsorSupabase } from "@/integrations/supabase/sponsor-client";
import { sponsorBootstrapSession } from "./sponsor.functions";

export const sponsorSessionQuery = queryOptions({
  queryKey: ["sponsor-session-bootstrap"],
  queryFn: async () => {
    const { data } = await sponsorSupabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Not signed in.");
    return sponsorBootstrapSession({ data: { accessToken } });
  },
  staleTime: 60_000,
  retry: false,
});

export function useSponsorSession() {
  return useQuery(sponsorSessionQuery);
}

export function useSponsorSignOut() {
  const navigate = useNavigate();
  return async () => {
    await sponsorSupabase.auth.signOut();
    navigate({ to: "/sponsors", replace: true });
  };
}
