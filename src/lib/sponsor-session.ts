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
    clearSponsorShuffleSeed();
    await sponsorSupabase.auth.signOut();
    navigate({ to: "/sponsors", replace: true });
  };
}

const SHUFFLE_SEED_KEY = "sponsor-shuffle-seed";
/** Used only when sessionStorage itself is unavailable (private browsing, etc). */
let fallbackShuffleSeed: number | null = null;

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * Call once, right after a sponsor's OTP verifies, so each login gets its
 * own randomized resume order (PRD: "shuffled once when the sponsor logs
 * in"). Stored in sessionStorage rather than component state so it survives
 * a page reload without reshuffling.
 */
export function resetSponsorShuffleSeed(): void {
  try {
    sessionStorage.setItem(SHUFFLE_SEED_KEY, String(randomSeed()));
  } catch {
    fallbackShuffleSeed = randomSeed();
  }
}

/** Stable for the sponsor's whole session; lazily created if somehow missing. */
export function getSponsorShuffleSeed(): number {
  try {
    const stored = sessionStorage.getItem(SHUFFLE_SEED_KEY);
    if (stored) return Number(stored);
    const seed = randomSeed();
    sessionStorage.setItem(SHUFFLE_SEED_KEY, String(seed));
    return seed;
  } catch {
    return (fallbackShuffleSeed ??= randomSeed());
  }
}

export function clearSponsorShuffleSeed(): void {
  try {
    sessionStorage.removeItem(SHUFFLE_SEED_KEY);
  } catch {
    // ignore -- nothing was persisted in the first place
  }
  fallbackShuffleSeed = null;
}
