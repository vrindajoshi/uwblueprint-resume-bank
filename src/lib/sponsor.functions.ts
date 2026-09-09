import { createServerFn } from "@tanstack/react-start";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const GENERIC_INVALID = {
  ok: false as const,
  error: "That code is invalid or has expired. Request a new one.",
};
const TOO_MANY_ATTEMPTS = {
  ok: false as const,
  error: "Too many incorrect attempts. Request a new code.",
};
const NOT_A_SPONSOR = {
  ok: false as const,
  error: "Your account isn't linked to a sponsor. Contact your Blueprint admin.",
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Sends a 6-digit OTP to `email` if -- and only if -- it's an admin-provisioned
 * sponsor contact. The response never reveals whether the email was registered:
 * always the same generic acknowledgement, so this endpoint can't be used to
 * enumerate sponsor companies or contacts.
 */
export const requestSponsorOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = normalizeEmail(data.email);

    const { data: match } = await supabaseAdmin
      .from("sponsor_emails")
      .select("sponsor_id")
      .eq("email", email)
      .maybeSingle();

    if (match) {
      // Requesting a new code invalidates any previously issued, unexpired code:
      // this upsert always resets the attempt counter and expiry for the email.
      const { error: upsertError } = await supabaseAdmin.from("sponsor_otp_requests").upsert(
        {
          email,
          sponsor_id: match.sponsor_id,
          attempt_count: 0,
          requested_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
          consumed: false,
        },
        { onConflict: "email" },
      );

      if (upsertError) {
        console.error("[sponsor-otp] failed to record OTP request:", upsertError.message);
      } else {
        const { error: sendError } = await supabaseAdmin.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (sendError) console.error("[sponsor-otp] signInWithOtp failed:", sendError.message);
      }
    }

    return { ok: true as const };
  });

/**
 * Verifies a sponsor's OTP and, on success, returns a real Supabase session
 * (access + refresh token) for the browser's sponsor-scoped client to adopt
 * via `setSession`. Attempt counting and expiry are enforced from our own
 * sponsor_otp_requests row, independent of Supabase Auth's own OTP lifetime.
 */
export const verifySponsorOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; code: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = normalizeEmail(data.email);
    const code = data.code.trim();

    const { data: request } = await supabaseAdmin
      .from("sponsor_otp_requests")
      .select("attempt_count, expires_at, consumed")
      .eq("email", email)
      .maybeSingle();

    if (!request || request.consumed || new Date(request.expires_at).getTime() < Date.now()) {
      return GENERIC_INVALID;
    }
    if (request.attempt_count >= MAX_ATTEMPTS) {
      return TOO_MANY_ATTEMPTS;
    }

    // supabaseAdmin is used statelessly here: we only read the session object
    // this call resolves with, never `getSession()`/`getUser()` off the shared
    // client, so concurrent verifications can't cross-contaminate each other.
    const { data: verified, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verifyError || !verified.session) {
      const attempt_count = request.attempt_count + 1;
      const lockedOut = attempt_count >= MAX_ATTEMPTS;
      await supabaseAdmin
        .from("sponsor_otp_requests")
        .update({ attempt_count, consumed: lockedOut })
        .eq("email", email);
      return lockedOut ? TOO_MANY_ATTEMPTS : GENERIC_INVALID;
    }

    await supabaseAdmin.from("sponsor_otp_requests").update({ consumed: true }).eq("email", email);

    const { data: sponsorEmail } = await supabaseAdmin
      .from("sponsor_emails")
      .select("sponsor_id")
      .eq("email", email)
      .maybeSingle();
    const sponsor = sponsorEmail
      ? (
          await supabaseAdmin
            .from("sponsors")
            .select("id, name")
            .eq("id", sponsorEmail.sponsor_id)
            .maybeSingle()
        ).data
      : null;

    if (!sponsor) {
      try {
        await supabaseAdmin.auth.admin.signOut(verified.session.access_token);
      } catch {
        // best effort cleanup -- the session's own 1-hour expiry is the backstop
      }
      return NOT_A_SPONSOR;
    }

    return {
      ok: true as const,
      session: {
        access_token: verified.session.access_token,
        refresh_token: verified.session.refresh_token,
      },
      sponsor: { id: sponsor.id, name: sponsor.name },
    };
  });

/** Resolves the signed-in sponsor for a sponsor-portal access token. */
export const sponsorBootstrapSession = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = userData.user?.email?.toLowerCase();
    if (userError || !email) throw new Error("Not signed in as a sponsor contact.");

    const { data: sponsorEmail } = await supabaseAdmin
      .from("sponsor_emails")
      .select("sponsor_id")
      .eq("email", email)
      .maybeSingle();
    if (!sponsorEmail) throw new Error("Not signed in as a sponsor contact.");

    const { data: sponsor } = await supabaseAdmin
      .from("sponsors")
      .select("id, name")
      .eq("id", sponsorEmail.sponsor_id)
      .maybeSingle();
    if (!sponsor) throw new Error("Not signed in as a sponsor contact.");

    return { sponsor };
  });
