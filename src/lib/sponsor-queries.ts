import { queryOptions } from "@tanstack/react-query";
import { sponsorSupabase } from "@/integrations/supabase/sponsor-client";
import type { Category, Member, Resume, SponsorEmail } from "./queries";

// Sponsor-portal reads. Deliberately separate from queries.ts (which uses the
// main `supabase` client): these go through `sponsorSupabase`, and RLS
// (see 20260913140000_sponsor_resume_access.sql) narrows every result to
// whatever the signed-in sponsor has been granted -- there's no client-side
// filtering to get wrong here, the rows simply aren't returned otherwise.

export const sponsorCategoriesQuery = queryOptions({
  queryKey: ["sponsor", "categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await sponsorSupabase.from("categories").select("*").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Category[];
  },
});

export const sponsorResumesQuery = queryOptions({
  queryKey: ["sponsor", "resumes"],
  queryFn: async (): Promise<Resume[]> => {
    const { data, error } = await sponsorSupabase.from("resumes").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as Resume[];
  },
});

export const sponsorMembersQuery = queryOptions({
  queryKey: ["sponsor", "members"],
  queryFn: async (): Promise<Member[]> => {
    const { data, error } = await sponsorSupabase.from("members").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as Member[];
  },
});

export const sponsorContactsQuery = queryOptions({
  queryKey: ["sponsor", "contacts"],
  queryFn: async (): Promise<SponsorEmail[]> => {
    const { data, error } = await sponsorSupabase
      .from("sponsor_emails")
      .select("*")
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as SponsorEmail[];
  },
});

export async function sponsorSignedUrlFor(path: string): Promise<string> {
  const { data, error } = await sponsorSupabase.storage.from("resumes").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
