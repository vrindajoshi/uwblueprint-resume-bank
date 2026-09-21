-- Fixes "infinite recursion detected in policy for relation members".
--
-- Any select against members has to evaluate every permissive select policy
-- on that table, including members_select_sponsor, which subqueries
-- resumes. Evaluating resumes' own select policies then requires
-- resumes_select_own_or_admin, which subqueries members again
-- (select id from members where email = jwt_email()) -- and
-- members_select_sponsor fires again. That's unbounded recursion, and it
-- hits ordinary members too, not just sponsors, since
-- resumes_select_own_or_admin runs for every resumes query regardless of
-- who's asking.
--
-- current_sponsor_id() has the identical shape one table over: it
-- subqueries sponsor_emails from inside sponsor_emails_select_own, a policy
-- defined on sponsor_emails itself.
--
-- Fix: move each self-referential lookup into a SECURITY DEFINER function
-- that bypasses RLS on the table it reads. Safe because every one of these
-- is hard-scoped to the caller's own jwt_email() claim, never to
-- caller-supplied input, so it can't be used to read anyone else's row.

create or replace function public.current_member_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where lower(email) = public.jwt_email()
$$;

revoke all on function public.current_member_id() from public, anon;
grant execute on function public.current_member_id() to authenticated;

create or replace function public.current_sponsor_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select sponsor_id from public.sponsor_emails where email = public.jwt_email()
$$;

create or replace function public.sponsor_visible_member_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select r.member_id
  from public.resumes r
  where r.category_id in (
    select category_id from public.sponsor_category_access
    where sponsor_id = public.current_sponsor_id()
  )
$$;

revoke all on function public.sponsor_visible_member_ids() from public, anon;
grant execute on function public.sponsor_visible_member_ids() to authenticated;

-- resumes policies: stop subquerying members directly.
drop policy resumes_select_own_or_admin on public.resumes;
create policy resumes_select_own_or_admin on public.resumes
for select to authenticated
using (public.is_blueprint() and (public.is_admin() or member_id = public.current_member_id()));

drop policy resumes_insert_own on public.resumes;
create policy resumes_insert_own on public.resumes
for insert to authenticated
with check (public.is_blueprint() and member_id = public.current_member_id());

drop policy resumes_update_own on public.resumes;
create policy resumes_update_own on public.resumes
for update to authenticated
using (public.is_blueprint() and member_id = public.current_member_id())
with check (public.is_blueprint() and member_id = public.current_member_id());

drop policy resumes_delete_own_or_admin on public.resumes;
create policy resumes_delete_own_or_admin on public.resumes
for delete to authenticated
using (public.is_blueprint() and (public.is_admin() or member_id = public.current_member_id()));

-- members policy: stop subquerying resumes directly.
drop policy members_select_sponsor on public.members;
create policy members_select_sponsor on public.members
for select to authenticated
using (public.is_sponsor_contact() and id in (select public.sponsor_visible_member_ids()));
