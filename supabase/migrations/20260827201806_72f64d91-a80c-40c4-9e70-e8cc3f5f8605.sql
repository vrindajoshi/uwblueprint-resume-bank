create extension if not exists "pgcrypto";

create or replace function public.jwt_email()
returns text language sql stable as $$
  select lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''))
$$;

create or replace function public.is_blueprint()
returns boolean language sql stable as $$
  select public.jwt_email() like '%@uwblueprint.org'
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.jwt_email() = 'vrindajoshi@uwblueprint.org'
$$;

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table public.members (
  id             uuid primary key default gen_random_uuid(),
  first_name     text not null,
  last_name      text not null,
  email          text not null unique,
  linkedin_url   text,
  github_url     text,
  portfolio_url  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.resumes (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  file_path    text not null,
  uploaded_at  timestamptz not null default now(),
  unique (member_id, category_id)
);

create index idx_resumes_member_id on public.resumes(member_id);
create index idx_resumes_category_id on public.resumes(category_id);

create view public.members_with_term
with (security_invoker = true) as
select
  m.*,
  coalesce(latest.uploaded_at, m.updated_at) as term_basis_date,
  case
    when extract(month from coalesce(latest.uploaded_at, m.updated_at)) between 1 and 4 then 'Winter'
    when extract(month from coalesce(latest.uploaded_at, m.updated_at)) between 5 and 8 then 'Spring'
    else 'Fall'
  end as term_season,
  extract(year from coalesce(latest.uploaded_at, m.updated_at))::int as term_year
from public.members m
left join (
  select member_id, max(uploaded_at) as uploaded_at
  from public.resumes
  group by member_id
) latest on latest.member_id = m.id;

-- name fields are locked for non-admins
create or replace function public.lock_member_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.first_name := old.first_name;
    new.last_name  := old.last_name;
    new.email      := old.email;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger members_lock_identity
before update on public.members
for each row execute function public.lock_member_identity();

grant select, insert, update on public.members to authenticated;
grant delete on public.members to authenticated;
grant select on public.categories to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.resumes to authenticated;
grant select on public.members_with_term to authenticated;
grant all on public.members to service_role;
grant all on public.categories to service_role;
grant all on public.resumes to service_role;
grant all on public.members_with_term to service_role;

alter table public.members enable row level security;
alter table public.categories enable row level security;
alter table public.resumes enable row level security;

create policy members_select_own_or_admin on public.members
for select to authenticated
using (public.is_blueprint() and (public.is_admin() or lower(email) = public.jwt_email()));

create policy members_insert_self on public.members
for insert to authenticated
with check (public.is_blueprint() and lower(email) = public.jwt_email());

create policy members_update_own_or_admin on public.members
for update to authenticated
using (public.is_blueprint() and (public.is_admin() or lower(email) = public.jwt_email()))
with check (public.is_blueprint() and (public.is_admin() or lower(email) = public.jwt_email()));

create policy members_delete_admin on public.members
for delete to authenticated
using (public.is_admin());

create policy categories_select_all on public.categories
for select to authenticated
using (public.is_blueprint());

create policy categories_write_admin on public.categories
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy resumes_select_own_or_admin on public.resumes
for select to authenticated
using (public.is_blueprint() and (public.is_admin() or member_id in (
  select id from public.members where lower(email) = public.jwt_email()
)));

create policy resumes_insert_own on public.resumes
for insert to authenticated
with check (public.is_blueprint() and member_id in (
  select id from public.members where lower(email) = public.jwt_email()
));

create policy resumes_update_own on public.resumes
for update to authenticated
using (public.is_blueprint() and member_id in (
  select id from public.members where lower(email) = public.jwt_email()
))
with check (public.is_blueprint() and member_id in (
  select id from public.members where lower(email) = public.jwt_email()
));

create policy resumes_delete_own_or_admin on public.resumes
for delete to authenticated
using (public.is_blueprint() and (public.is_admin() or member_id in (
  select id from public.members where lower(email) = public.jwt_email()
)));

insert into public.categories (name) values ('Product'), ('Design'), ('Development');