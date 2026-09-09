// Sponsor-portal Supabase client. Deliberately separate from the main
// `supabase` client (src/integrations/supabase/client.ts): sponsor sessions
// live under their own storage key and never auto-refresh, so a sponsor is
// signed out ~1 hour after login regardless of activity, matching the
// sponsor login PRD, without touching member/admin session behavior.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSponsorSupabaseClient() {
  const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(", ")}. Connect Supabase in Lovable Cloud.`,
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storageKey: "sb-sponsor-auth-token",
      persistSession: true,
      autoRefreshToken: false,
    },
  });
}

let _sponsorSupabase: ReturnType<typeof createSponsorSupabaseClient> | undefined;

// Import like: import { sponsorSupabase } from "@/integrations/supabase/sponsor-client";
// Use only under the /sponsors and /sponsor routes -- never mix with the main `supabase` client.
export const sponsorSupabase = new Proxy({} as ReturnType<typeof createSponsorSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_sponsorSupabase) _sponsorSupabase = createSponsorSupabaseClient();
    return Reflect.get(_sponsorSupabase, prop, receiver);
  },
});
