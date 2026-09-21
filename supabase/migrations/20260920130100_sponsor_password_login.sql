-- Sponsor login pivot: from email-OTP to an admin-issued temporary password.
-- (OTP delivery hit two unresolvable blockers on the hosted project: no
-- verified Resend sending domain, and free-tier Supabase blocking custom
-- email template modification entirely.) Admins now generate a temp password
-- per sponsor contact (src/lib/sponsor.functions.ts issueSponsorPassword);
-- user_id links the sponsor_emails row to the auth.users record it manages,
-- and must_change_password gates portal access until the sponsor sets their
-- own password.
alter table public.sponsor_emails
  add column user_id uuid references auth.users(id) on delete set null,
  add column must_change_password boolean not null default true;

-- No longer needed now that sign-in isn't OTP-based.
drop table public.sponsor_otp_requests;
