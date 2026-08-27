import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_DOMAIN = "uwblueprint.org";
const MAX_BYTES = 5 * 1024 * 1024;

function adminEmail(): string {
  return (process.env["ADMIN_EMAIL"] ?? "info@uwblueprint.org").toLowerCase();
}

function verifiedEmail(claims: Record<string, unknown>): string {
  const email = String(claims["email"] ?? "").toLowerCase();
  if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    throw new Error(`Access is restricted to ${ALLOWED_DOMAIN} accounts.`);
  }
  return email;
}

function nameFromClaims(claims: Record<string, unknown>, email: string) {
  const meta = (claims["user_metadata"] ?? {}) as Record<string, unknown>;
  const full = String(meta["full_name"] ?? meta["name"] ?? "").trim();
  const given = String(meta["given_name"] ?? "").trim();
  const family = String(meta["family_name"] ?? "").trim();
  if (given || family) return { first: given || email.split("@")[0]!, last: family || "" };
  if (full) {
    const parts = full.split(/\s+/);
    return { first: parts[0]!, last: parts.slice(1).join(" ") };
  }
  return { first: email.split("@")[0]!, last: "" };
}

/** Verifies the domain server-side, then ensures a members row exists. */
export const bootstrapSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as unknown as Record<string, unknown>;
    const email = verifiedEmail(claims);
    const isAdmin = email === adminEmail();

    if (isAdmin) {
      return { email, isAdmin: true as const, needsOnboarding: false, memberId: null };
    }

    const { data: existing } = await context.supabase
      .from("members")
      .select("id, created_at, updated_at")
      .eq("email", email)
      .maybeSingle();

    let member = existing;
    if (!member) {
      const { first, last } = nameFromClaims(claims, email);
      const { data: created, error } = await context.supabase
        .from("members")
        .insert({ first_name: first, last_name: last, email })
        .select("id, created_at, updated_at")
        .single();
      if (error) throw new Error(error.message);
      member = created;
    }

    return {
      email,
      isAdmin: false as const,
      needsOnboarding: member.created_at === member.updated_at,
      memberId: member.id,
    };
  });

/** Server-side enforced PDF-only, 5MB-max upload that replaces any prior file. */
export const uploadResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { categoryId: string; fileBase64: string }) => input)
  .handler(async ({ data, context }) => {
    const claims = context.claims as unknown as Record<string, unknown>;
    const email = verifiedEmail(claims);

    const bytes = Buffer.from(data.fileBase64, "base64");
    if (bytes.byteLength === 0) throw new Error("The uploaded file is empty.");
    if (bytes.byteLength > MAX_BYTES) throw new Error("Resume must be 5MB or smaller.");
    if (bytes.subarray(0, 4).toString("latin1") !== "%PDF") {
      throw new Error("Only PDF files are accepted.");
    }

    const { data: member, error: memberError } = await context.supabase
      .from("members")
      .select("id")
      .eq("email", email)
      .single();
    if (memberError || !member) throw new Error("Member profile not found.");

    const path = `${email}/${data.categoryId}.pdf`;
    const { error: uploadError } = await context.supabase.storage
      .from("resumes")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { error: rowError } = await context.supabase
      .from("resumes")
      .upsert(
        { member_id: member.id, category_id: data.categoryId, file_path: path, uploaded_at: new Date().toISOString() },
        { onConflict: "member_id,category_id" },
      );
    if (rowError) throw new Error(rowError.message);

    return { path };
  });
