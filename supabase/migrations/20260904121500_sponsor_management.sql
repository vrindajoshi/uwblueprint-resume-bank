-- Sponsor management (Admin Dashboard Sponsors tab): builds on the sponsors/
-- sponsor_emails schema laid down by the sponsor OTP login migration
-- (20260904120000_sponsor_login.sql) rather than recreating it. Adds a slug
-- for the admin's per-sponsor profile page, per-category resume access
-- grants, and negotiated perks.

alter table public.sponsors add column slug text;

update public.sponsors
set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
where slug is null;

alter table public.sponsors alter column slug set not null;
create unique index sponsors_name_key on public.sponsors (lower(name));
create unique index sponsors_slug_key on public.sponsors (slug);

-- Defense in depth: the admin-side guardrail against provisioning Blueprint
-- accounts as sponsor contacts, enforced at the DB level too.
alter table public.sponsor_emails
  add constraint sponsor_emails_not_blueprint check (lower(email) not like '%@uwblueprint.org');

create table public.sponsor_category_access (
  sponsor_id   uuid not null references public.sponsors(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (sponsor_id, category_id)
);

create index idx_sponsor_category_access_category_id on public.sponsor_category_access(category_id);

create table public.sponsor_perks (
  id          uuid primary key default gen_random_uuid(),
  sponsor_id  uuid not null references public.sponsors(id) on delete cascade,
  description text not null,
  status      text not null default 'not_redeemed' check (status in ('not_redeemed', 'redeemed')),
  created_at  timestamptz not null default now()
);

create index idx_sponsor_perks_sponsor_id on public.sponsor_perks(sponsor_id);

grant select, insert, update, delete on public.sponsor_category_access to authenticated;
grant select, insert, update, delete on public.sponsor_perks to authenticated;
grant all on public.sponsor_category_access to service_role;
grant all on public.sponsor_perks to service_role;

alter table public.sponsor_category_access enable row level security;
alter table public.sponsor_perks enable row level security;

create policy sponsor_category_access_admin_all on public.sponsor_category_access
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy sponsor_perks_admin_all on public.sponsor_perks
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Creates a sponsor plus its emails, category grants and perks in one
-- transaction, so the admin's "Save" on the create-sponsor flow can't leave a
-- half-created sponsor behind on a partial failure. Slug is derived from the
-- name and de-duplicated with a numeric suffix.
create or replace function public.admin_create_sponsor(
  p_name text,
  p_emails text[],
  p_category_ids uuid[],
  p_perks text[]
) returns public.sponsors
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sponsor     public.sponsors;
  v_base_slug   text;
  v_slug        text;
  v_suffix      int := 1;
  v_email       text;
  v_category_id uuid;
  v_perk        text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create sponsors';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Sponsor name is required';
  end if;

  if p_emails is null or array_length(p_emails, 1) is null then
    raise exception 'At least one email is required';
  end if;

  foreach v_email in array p_emails loop
    if lower(v_email) like '%@uwblueprint.org' then
      raise exception 'Sponsor emails cannot use the uwblueprint.org domain';
    end if;
  end loop;

  v_base_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base_slug = '' then
    v_base_slug := 'sponsor';
  end if;
  v_slug := v_base_slug;
  while exists (select 1 from public.sponsors where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.sponsors (name, slug)
  values (trim(p_name), v_slug)
  returning * into v_sponsor;

  foreach v_email in array p_emails loop
    insert into public.sponsor_emails (sponsor_id, email)
    values (v_sponsor.id, lower(trim(v_email)));
  end loop;

  if p_category_ids is not null then
    foreach v_category_id in array p_category_ids loop
      insert into public.sponsor_category_access (sponsor_id, category_id)
      values (v_sponsor.id, v_category_id);
    end loop;
  end if;

  if p_perks is not null then
    foreach v_perk in array p_perks loop
      if trim(v_perk) <> '' then
        insert into public.sponsor_perks (sponsor_id, description)
        values (v_sponsor.id, trim(v_perk));
      end if;
    end loop;
  end if;

  return v_sponsor;
end;
$$;

revoke all on function public.admin_create_sponsor(text, text[], uuid[], text[]) from public, anon;
grant execute on function public.admin_create_sponsor(text, text[], uuid[], text[]) to authenticated;