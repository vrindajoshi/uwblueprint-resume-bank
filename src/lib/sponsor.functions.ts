import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { supabaseAdmin as SupabaseAdminSingleton } from "@/integrations/supabase/client.server";

type SupabaseAdminClient = typeof SupabaseAdminSingleton;

const BLUEPRINT_DOMAIN = "uwblueprint.org";

// Excludes visually ambiguous characters (0/O, 1/l/I) so a temp password is
// easy to read back and retype from wherever an admin relays it.
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 14): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length]).join(
    "",
  );
}

/**
 * The admin API has no getUserByEmail, only paginated listUsers -- needed as
 * a one-time recovery path for contacts whose auth.users record predates the
 * user_id column (e.g. created by the old OTP flow's shouldCreateUser).
 * Bounded scan: this app's user count is small enough that a full search is
 * cheap and simpler than maintaining a secondary index just for this case.
 */
async function findAuthUserIdByEmail(
  supabaseAdmin: SupabaseAdminClient,
  email: string,
): Promise<string | null> {
  const perPage = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

/**
 * Issues a fresh temp password for a sponsor_emails row -- creating its
 * auth.users record on first issuance, or resetting the existing one's
 * password otherwise -- and marks the contact as needing to change it.
 * Shared by sponsor creation, adding a single contact, invite approval, and
 * the admin "reissue password" action, so there's exactly one place that
 * knows how to mint a sponsor credential.
 */
async function issueSponsorPassword(
  supabaseAdmin: SupabaseAdminClient,
  row: { id: string; email: string; user_id: string | null },
): Promise<string> {
  const tempPassword = generateTempPassword();
  let userId = row.user_id;

  if (userId) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: row.email,
      password: tempPassword,
      email_confirm: true,
    });
    if (created?.user) {
      userId = created.user.id;
    } else if (error?.code === "email_exists") {
      userId = await findAuthUserIdByEmail(supabaseAdmin, row.email);
      if (!userId) throw new Error(error.message);
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
        email_confirm: true,
      });
      if (resetError) throw new Error(resetError.message);
    } else {
      throw new Error(error?.message ?? "Could not create sign-in credentials.");
    }

    const { error: linkError } = await supabaseAdmin
      .from("sponsor_emails")
      .update({ user_id: userId })
      .eq("id", row.id);
    if (linkError) throw new Error(linkError.message);
  }

  const { error: flagError } = await supabaseAdmin
    .from("sponsor_emails")
    .update({ must_change_password: true })
    .eq("id", row.id);
  if (flagError) throw new Error(flagError.message);

  return tempPassword;
}

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
      .select("sponsor_id, must_change_password")
      .eq("email", email)
      .maybeSingle();
    if (!sponsorEmail) throw new Error("Not signed in as a sponsor contact.");

    const { data: sponsor } = await supabaseAdmin
      .from("sponsors")
      .select("id, name")
      .eq("id", sponsorEmail.sponsor_id)
      .maybeSingle();
    if (!sponsor) throw new Error("Not signed in as a sponsor contact.");

    return { sponsor, email, mustChangePassword: sponsorEmail.must_change_password };
  });

/**
 * Clears must_change_password after a sponsor contact has set their own
 * password. The password change itself must happen client-side via
 * sponsorSupabase.auth.updateUser() -- doing it through the admin API here
 * instead invalidates the caller's own current session as a side effect
 * (confirmed against the live project: an admin-issued password change
 * immediately breaks the session that made the request), which bounced
 * sponsors back to the login page right after they'd just signed in.
 */
export const sponsorConfirmPasswordChanged = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (userError || !userData.user?.email) throw new Error("Not signed in as a sponsor contact.");
    const email = userData.user.email.toLowerCase();

    const { data: sponsorEmail } = await supabaseAdmin
      .from("sponsor_emails")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!sponsorEmail) throw new Error("Not signed in as a sponsor contact.");

    await supabaseAdmin
      .from("sponsor_emails")
      .update({ must_change_password: false })
      .eq("id", sponsorEmail.id);

    return { ok: true as const };
  });

/**
 * Admin-only: creates a sponsor (via the existing admin_create_sponsor RPC,
 * still admin-gated at the DB layer too) and issues each initial contact a
 * temp password. Per-contact credential issuance is best-effort -- one
 * failure doesn't block the others -- since the sponsor row itself is
 * already committed by this point.
 */
export const adminCreateSponsor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      emails: string[];
      categoryIds: string[];
      perks: string[];
      websiteUrl: string;
      logoUrl?: string | null;
      logoSource: "favicon" | "custom";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Unauthorized");

    const { data: sponsor, error } = await context.supabase.rpc("admin_create_sponsor", {
      p_name: data.name,
      p_emails: data.emails,
      p_category_ids: data.categoryIds,
      p_perks: data.perks,
      p_website_url: data.websiteUrl,
      p_logo_source: data.logoSource,
      ...(data.logoUrl ? { p_logo_url: data.logoUrl } : {}),
    });
    if (error || !sponsor) throw new Error(error?.message ?? "Could not create sponsor.");

    const { data: rows } = await context.supabase
      .from("sponsor_emails")
      .select("id, email, user_id")
      .eq("sponsor_id", sponsor.id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const credentials = await Promise.all(
      (rows ?? []).map(async (row) => {
        try {
          const tempPassword = await issueSponsorPassword(supabaseAdmin, row);
          return { email: row.email, tempPassword, error: null as string | null };
        } catch (e) {
          return {
            email: row.email,
            tempPassword: null as string | null,
            error: e instanceof Error ? e.message : "Could not issue a password.",
          };
        }
      }),
    );

    return { sponsor, credentials };
  });

/** Admin-only: authorizes a new contact for an existing sponsor and issues their temp password. */
export const adminAddSponsorContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sponsorId: string; email: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Unauthorized");

    const email = data.email.trim().toLowerCase();
    const { data: row, error } = await context.supabase
      .from("sponsor_emails")
      .insert({ sponsor_id: data.sponsorId, email })
      .select("id, email, user_id")
      .single();
    if (error || !row) {
      throw new Error(
        error?.code === "23505"
          ? "That email is already registered to a sponsor."
          : (error?.message ?? "Could not add contact."),
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tempPassword = await issueSponsorPassword(supabaseAdmin, row);
    return { email: row.email, tempPassword };
  });

/** Admin-only: issues a fresh temp password for an existing contact (lost password, or backfilling one that never got one). */
export const adminReissueSponsorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sponsorEmailId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Unauthorized");

    const { data: row, error } = await context.supabase
      .from("sponsor_emails")
      .select("id, email, user_id")
      .eq("id", data.sponsorEmailId)
      .single();
    if (error || !row) throw new Error("Contact not found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tempPassword = await issueSponsorPassword(supabaseAdmin, row);
    return { email: row.email, tempPassword };
  });

const INVITE_INVALID_EMAIL = "Enter a valid email address.";

/**
 * Queues a request for a colleague to be added as an authorized sponsor
 * contact. Never grants access itself (PRD non-goal) -- it records the
 * request for admin review and best-effort emails partnerships@uwblueprint.org
 * via Resend. All writes go through the service-role client: sponsor contacts
 * have no direct insert policy on sponsor_invite_requests.
 */
export const requestSponsorInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; invitedEmail: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);
    const requestedBy = userData.user?.email?.toLowerCase();
    if (userError || !requestedBy) throw new Error("Not signed in as a sponsor contact.");

    const { data: sponsorEmail } = await supabaseAdmin
      .from("sponsor_emails")
      .select("sponsor_id")
      .eq("email", requestedBy)
      .maybeSingle();
    if (!sponsorEmail) throw new Error("Not signed in as a sponsor contact.");

    const { data: sponsor } = await supabaseAdmin
      .from("sponsors")
      .select("id, name")
      .eq("id", sponsorEmail.sponsor_id)
      .maybeSingle();
    if (!sponsor) throw new Error("Not signed in as a sponsor contact.");

    const invitedEmail = data.invitedEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) throw new Error(INVITE_INVALID_EMAIL);
    if (invitedEmail.endsWith(`@${BLUEPRINT_DOMAIN}`)) {
      throw new Error("That email can't be added as a sponsor contact.");
    }

    const { data: existingContact } = await supabaseAdmin
      .from("sponsor_emails")
      .select("id")
      .eq("email", invitedEmail)
      .maybeSingle();
    if (existingContact) throw new Error("That email is already authorized to sign in.");

    const { error: insertError } = await supabaseAdmin.from("sponsor_invite_requests").insert({
      sponsor_id: sponsor.id,
      requested_by: requestedBy,
      invited_email: invitedEmail,
    });
    if (insertError) throw new Error(insertError.message);

    // Best-effort notification -- the request is already queued for admin
    // review regardless of whether this send succeeds.
    try {
      const apiKey = process.env["RESEND_API_KEY"];
      if (!apiKey) {
        console.error("[sponsor-invite] RESEND_API_KEY not set; skipping email notification.");
      } else {
        const { Resend } = await import("resend");
        const resend = new Resend(apiKey);
        const { error: sendError } = await resend.emails.send({
          from:
            process.env["SPONSOR_NOTIFICATIONS_FROM"] ??
            "UW Blueprint Resume Book <notifications@uwblueprint.org>",
          to: "partnerships@uwblueprint.org",
          subject: `Sponsor teammate request: ${sponsor.name}`,
          text: `${requestedBy} at ${sponsor.name} requested portal access for ${invitedEmail}.\n\nApprove by adding ${invitedEmail} as an authorized contact for ${sponsor.name} in the Admin Dashboard's Sponsors tab.`,
        });
        if (sendError) console.error("[sponsor-invite] Resend send failed:", sendError.message);
      }
    } catch (e) {
      console.error(
        "[sponsor-invite] failed to send notification email:",
        e instanceof Error ? e.message : e,
      );
    }

    return { ok: true as const };
  });
