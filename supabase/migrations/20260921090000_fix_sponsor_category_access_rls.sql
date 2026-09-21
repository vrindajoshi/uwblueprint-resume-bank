-- Fixes sponsor category-access grants never actually applying.
--
-- categories_select_sponsor, resumes_select_sponsor and the resumes_read_sponsor
-- storage policy (20260913140000_sponsor_resume_access.sql) each subquery
-- sponsor_category_access directly. But sponsor_category_access has RLS
-- enabled with only one policy -- sponsor_category_access_admin_all, admin-only
-- (20260904121500_sponsor_management.sql) -- so when a non-admin sponsor's
-- query evaluates that subquery, it's itself filtered by RLS down to zero
-- rows, and the "id in (...)" check is always false. Net effect: no sponsor
-- has ever been able to see a category or resume regardless of what access an
-- admin granted them.
--
-- This is the same shape of bug 20260920130000_fix_members_rls_recursion.sql
-- already fixed for members_select_sponsor via a SECURITY DEFINER function
-- (sponsor_visible_member_ids) -- that one works today because it bypasses
-- sponsor_category_access's RLS internally. Applying the same fix here.

create or replace function public.sponsor_granted_category_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select category_id from public.sponsor_category_access
  where sponsor_id = public.current_sponsor_id()
$$;

revoke all on function public.sponsor_granted_category_ids() from public, anon;
grant execute on function public.sponsor_granted_category_ids() to authenticated;

drop policy categories_select_sponsor on public.categories;
create policy categories_select_sponsor on public.categories
for select to authenticated
using (
  public.is_sponsor_contact()
  and id in (select public.sponsor_granted_category_ids())
);

drop policy resumes_select_sponsor on public.resumes;
create policy resumes_select_sponsor on public.resumes
for select to authenticated
using (
  public.is_sponsor_contact()
  and category_id in (select public.sponsor_granted_category_ids())
);

drop policy "resumes_read_sponsor" on storage.objects;
create policy "resumes_read_sponsor" on storage.objects
for select to authenticated
using (
  bucket_id = 'resumes'
  and public.is_sponsor_contact()
  and exists (
    select 1 from public.resumes r
    where r.file_path = name
      and r.category_id in (select public.sponsor_granted_category_ids())
  )
);
