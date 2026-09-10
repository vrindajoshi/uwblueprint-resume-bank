-- Sponsor login (PRD: sponsor OTP login): admin-provisioned company records,
-- authorized contact emails, and a server-only table tracking OTP request /
-- attempt state for the /sponsors login flow. This migration owns creating
-- the base sponsors/sponsor_emails tables -- the concurrent Admin Dashboard
-- Sponsors-tab provisioning work (20260904121500_sponsor_management.sql)
-- builds on top of these (adding slug, category access, perks) and must run
-- after this one.

create table public.sponsors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.sponsor_emails (
  id          uuid primary key default gen_random_uuid(),
  sponsor_id  uuid not null references public.sponsors(id) on delete cascade,
  email       text not null unique,
  created_at  timestamptz not null default now()
);

create index idx_sponsor_emails_sponsor_id on public.sponsor_emails(sponsor_id);

-- Server-only bookkeeping for the OTP login flow's business rules (10-minute
-- expiry, 5-attempt cap, invalidate-on-resend). Never exposed to anon/
-- authenticated roles -- read and written exclusively by service-role server
-- functions (src/lib/sponsor.functions.ts), independent of Supabase Auth's
-- own OTP token lifetime.
create table public.sponsor_otp_requests (
  email          text primary key,
  sponsor_id     uuid not null references public.sponsors(id) on delete cascade,
  attempt_count  int not null default 0,
  requested_at   timestamptz not null default now(),
  expires_at     timestamptz not null,
  consumed       boolean not null default false
);

create or replace function public.current_sponsor_id()
returns uuid language sql stable as $$
  select sponsor_id from public.sponsor_emails where email = public.jwt_email()
$$;

create or replace function public.is_sponsor_contact()
returns boolean language sql stable as $$
  select public.current_sponsor_id() is not null
$$;

grant select, insert, update, delete on public.sponsors to authenticated;
grant select, insert, update, delete on public.sponsor_emails to authenticated;
grant all on public.sponsors to service_role;
grant all on public.sponsor_emails to service_role;
grant all on public.sponsor_otp_requests to service_role;

alter table public.sponsors enable row level security;
alter table public.sponsor_emails enable row level security;
alter table public.sponsor_otp_requests enable row level security;

-- Admins provision sponsors/emails (Admin Dashboard Sponsors tab); a sponsor
-- contact can only ever read their own sponsor record.
create policy sponsors_select_own_or_admin on public.sponsors
for select to authenticated
using (public.is_admin() or id = public.current_sponsor_id());

create policy sponsors_write_admin on public.sponsors
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy sponsor_emails_admin_only on public.sponsor_emails
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No policies on sponsor_otp_requests: RLS is enabled with no grants to
-- anon/authenticated, so it's reachable only through the service-role client.

-- Seed data so the login flow is testable before the Sponsors admin tab ships.
insert into public.sponsors (name) values ('UW Blueprint Test Sponsor');

insert into public.sponsor_emails (sponsor_id, email)
select id, 'vrindajoshi30@gmail.com' from public.sponsors where name = 'UW Blueprint Test Sponsor';
