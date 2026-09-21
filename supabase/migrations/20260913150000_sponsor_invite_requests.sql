-- Sponsor portal Members tab: a sponsor contact can request a teammate be
-- added, but can't grant access themselves (PRD non-goal). This just queues
-- the request for admin review -- requestSponsorInvite
-- (src/lib/sponsor.functions.ts) is the only writer, using the service-role
-- client after validating the requester is a real sponsor contact and the
-- invited email isn't already authorized. No anon/authenticated insert
-- policy exists on purpose, same pattern as sponsor_otp_requests.

create table public.sponsor_invite_requests (
  id             uuid primary key default gen_random_uuid(),
  sponsor_id     uuid not null references public.sponsors(id) on delete cascade,
  requested_by   text not null,
  invited_email  text not null,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  created_at     timestamptz not null default now()
);

create index idx_sponsor_invite_requests_sponsor_id on public.sponsor_invite_requests(sponsor_id);

alter table public.sponsor_invite_requests
  add constraint sponsor_invite_requests_not_blueprint check (lower(invited_email) not like '%@uwblueprint.org');

grant all on public.sponsor_invite_requests to service_role;
grant select on public.sponsor_invite_requests to authenticated;

alter table public.sponsor_invite_requests enable row level security;

-- Read-only for admins today, ready for the upcoming Sponsors-tab approval UI.
create policy sponsor_invite_requests_admin_read on public.sponsor_invite_requests
for select to authenticated
using (public.is_admin());
