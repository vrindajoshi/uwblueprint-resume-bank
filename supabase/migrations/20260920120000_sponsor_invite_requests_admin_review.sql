-- Sponsors PRD: the sponsor profile page is where an admin approves/dismisses
-- a pending sponsor_invite_requests row (approve = add the invited email as
-- an authorized contact + mark it approved; dismiss = mark it dismissed).
-- 20260913150000_sponsor_invite_requests.sql only gave admins read access;
-- this adds the write path the review UI needs.
create policy sponsor_invite_requests_admin_update on public.sponsor_invite_requests
for update to authenticated
using (public.is_admin())
with check (public.is_admin());
