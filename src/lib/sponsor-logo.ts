import { supabase } from "@/integrations/supabase/client";

const LOGO_BUCKET = "sponsor-logos";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Normalizes a company URL typed by an admin ("acme.com", "www.acme.com",
 * "https://acme.com") into a full https?:// URL, or null if it's not a
 * plausible website. Bare domains are assumed https.
 */
export function normalizeWebsiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Derives a favicon image URL for a (normalized) website URL via Google's
 * public favicon service. Rendered in an <img>, so it works cross-origin
 * with no server-side fetch or CORS handling needed.
 */
export function faviconUrlFor(normalizedWebsiteUrl: string): string | null {
  try {
    const { hostname } = new URL(normalizedWebsiteUrl);
    return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(hostname)}`;
  } catch {
    return null;
  }
}

export function validateSponsorLogoFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Logo must be an image file.";
  if (file.size > MAX_LOGO_BYTES) return "Logo must be 2MB or smaller.";
  return null;
}

/** Uploads a custom sponsor logo and returns its public URL. */
export async function uploadSponsorLogo(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, file.type ? { contentType: file.type, upsert: false } : { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
