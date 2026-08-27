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
