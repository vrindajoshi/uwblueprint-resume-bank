import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Category = { id: string; name: string; created_at: string };

export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberWithTerm = Member & {
  term_basis_date: string;
  term_season: string;
  term_year: number;
};

export type Resume = {
  id: string;
  member_id: string;
  category_id: string;
  file_path: string;
  uploaded_at: string;
};

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Category[];
  },
});

export const myMemberQuery = (email: string) =>
  queryOptions({
    queryKey: ["member", email],
    queryFn: async (): Promise<Member | null> => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Member | null;
    },
    enabled: Boolean(email),
  });

export const myResumesQuery = (memberId: string | null | undefined) =>
  queryOptions({
    queryKey: ["resumes", memberId],
    queryFn: async (): Promise<Resume[]> => {
      const { data, error } = await supabase
        .from("resumes")
        .select("*")
        .eq("member_id", memberId!);
      if (error) throw new Error(error.message);
      return (data ?? []) as Resume[];
    },
    enabled: Boolean(memberId),
  });

export const allMembersQuery = queryOptions({
  queryKey: ["admin", "members"],
  queryFn: async (): Promise<MemberWithTerm[]> => {
    const { data, error } = await supabase
      .from("members_with_term")
      .select("*")
      .order("last_name");
    if (error) throw new Error(error.message);
    return (data ?? []) as MemberWithTerm[];
  },
});

export const allResumesQuery = queryOptions({
  queryKey: ["admin", "resumes"],
  queryFn: async (): Promise<Resume[]> => {
    const { data, error } = await supabase.from("resumes").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as Resume[];
  },
});

export type LogoSource = "favicon" | "custom";

export type Sponsor = {
  id: string;
  name: string;
  slug: string;
  website_url: string;
  logo_url: string | null;
  logo_source: LogoSource;
  created_at: string;
};

export type SponsorEmail = {
  id: string;
  sponsor_id: string;
  email: string;
  created_at: string;
};

export type SponsorCategoryAccess = {
  sponsor_id: string;
  category_id: string;
  created_at: string;
};

export type PerkStatus = "not_redeemed" | "redeemed";

export type SponsorPerk = {
  id: string;
  sponsor_id: string;
  description: string;
  status: PerkStatus;
  created_at: string;
};

export const sponsorsQuery = queryOptions({
  queryKey: ["admin", "sponsors"],
  queryFn: async (): Promise<Sponsor[]> => {
    const { data, error } = await supabase.from("sponsors").select("*").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Sponsor[];
  },
});

export const allSponsorEmailsQuery = queryOptions({
  queryKey: ["admin", "sponsor-emails"],
  queryFn: async (): Promise<SponsorEmail[]> => {
    const { data, error } = await supabase.from("sponsor_emails").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as SponsorEmail[];
  },
});

export const allSponsorCategoryAccessQuery = queryOptions({
  queryKey: ["admin", "sponsor-category-access"],
  queryFn: async (): Promise<SponsorCategoryAccess[]> => {
    const { data, error } = await supabase.from("sponsor_category_access").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as SponsorCategoryAccess[];
  },
});

export const allSponsorPerksQuery = queryOptions({
  queryKey: ["admin", "sponsor-perks"],
  queryFn: async (): Promise<SponsorPerk[]> => {
    const { data, error } = await supabase.from("sponsor_perks").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as SponsorPerk[];
  },
});

export type InviteRequestStatus = "pending" | "approved" | "dismissed";

export type SponsorInviteRequest = {
  id: string;
  sponsor_id: string;
  requested_by: string;
  invited_email: string;
  status: InviteRequestStatus;
  created_at: string;
};

export const pendingSponsorInviteRequestsQuery = queryOptions({
  queryKey: ["admin", "sponsor-invite-requests"],
  queryFn: async (): Promise<SponsorInviteRequest[]> => {
    const { data, error } = await supabase
      .from("sponsor_invite_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as SponsorInviteRequest[];
  },
});

export const BLUEPRINT_DOMAIN = "uwblueprint.org";

export function validateSponsorEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter an email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Enter a valid email address.";
  if (trimmed.toLowerCase().endsWith(`@${BLUEPRINT_DOMAIN}`)) {
    return `Sponsor contacts can't use a ${BLUEPRINT_DOMAIN} email.`;
  }
  return null;
}

export function termLabel(m: { term_season: string; term_year: number }) {
  return `${m.term_season} ${m.term_year}`;
}

export function termOf(dateIso: string) {
  const d = new Date(dateIso);
  const month = d.getUTCMonth() + 1;
  const season = month <= 4 ? "Winter" : month <= 8 ? "Spring" : "Fall";
  return `${season} ${d.getUTCFullYear()}`;
}

export async function signedUrlFor(path: string) {
  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
