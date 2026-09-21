-- Sponsor portal (PRD: sponsor Resumes + Members tabs): sponsor contacts
-- authenticate via the same Supabase Auth JWTs as the OTP login flow
-- (20260904120000_sponsor_login.sql), but until now had NO read access to
-- categories/members/resumes/storage -- those tables' only select policies
-- gate on is_blueprint(), which a sponsor's email can never satisfy (sponsor
-- emails are barred from the uwblueprint.org domain by a check constraint).
-- This adds sponsor-scoped read policies, restricted to whatever
-- sponsor_category_access (admin-granted) allows for that sponsor.

create policy categories_select_sponsor on public.categories
for select to authenticated
using (
  public.is_sponsor_contact()
  and id in (
    select category_id from public.sponsor_category_access
    where sponsor_id = public.current_sponsor_id()
  )
);

create policy resumes_select_sponsor on public.resumes
for select to authenticated
using (
  public.is_sponsor_contact()
  and category_id in (
    select category_id from public.sponsor_category_access
    where sponsor_id = public.current_sponsor_id()
  )
);

create policy members_select_sponsor on public.members
for select to authenticated
using (
  public.is_sponsor_contact()
  and id in (
    select r.member_id from public.resumes r
    where r.category_id in (
      select category_id from public.sponsor_category_access
      where sponsor_id = public.current_sponsor_id()
    )
  )
);

-- Sponsor contacts can see their own company's other authorized contacts
-- (Members tab list) -- writing stays admin-only via sponsor_emails_admin_only.
create policy sponsor_emails_select_own on public.sponsor_emails
for select to authenticated
using (sponsor_id = public.current_sponsor_id());

-- Signed URLs (view / ZIP export) require select on the underlying storage
-- object, scoped the same way as the resumes table policy above.
create policy "resumes_read_sponsor" on storage.objects
for select to authenticated
using (
  bucket_id = 'resumes'
  and public.is_sponsor_contact()
  and exists (
    select 1 from public.resumes r
    where r.file_path = name
      and r.category_id in (
        select category_id from public.sponsor_category_access
        where sponsor_id = public.current_sponsor_id()
      )
  )
);
