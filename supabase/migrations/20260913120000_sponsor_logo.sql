-- Sponsor branding (Admin Dashboard Sponsors tab): adds the company's
-- website URL and a display logo. The logo defaults to the site's favicon
-- (computed client-side from website_url, no server fetch needed) and can be
-- overridden by an admin-uploaded image stored in the new sponsor-logos
-- bucket. logo_source tracks which one is in effect so editing the website
-- URL later doesn't clobber a deliberately-uploaded custom logo.

alter table public.sponsors add column website_url text;
alter table public.sponsors add column logo_url text;
alter table public.sponsors add column logo_source text not null default 'favicon'
  check (logo_source in ('favicon', 'custom'));

update public.sponsors set website_url = 'https://uwblueprint.org' where website_url is null;
alter table public.sponsors alter column website_url set not null;

insert into storage.buckets (id, name, public)
values ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do update set public = excluded.public;

-- Public bucket: reads (the getPublicUrl() link admins/sponsors see) bypass
-- RLS entirely, so only writes need policies -- admins only.
create policy "sponsor_logos_admin_write" on storage.objects
for insert to authenticated
with check (bucket_id = 'sponsor-logos' and public.is_admin());

create policy "sponsor_logos_admin_update" on storage.objects
for update to authenticated
using (bucket_id = 'sponsor-logos' and public.is_admin())
with check (bucket_id = 'sponsor-logos' and public.is_admin());

create policy "sponsor_logos_admin_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'sponsor-logos' and public.is_admin());

-- admin_create_sponsor gains website/logo params. Signature changed (not
-- just a body swap), so the old overload is dropped explicitly rather than
-- left behind by CREATE OR REPLACE.
drop function if exists public.admin_create_sponsor(text, text[], uuid[], text[]);

create or replace function public.admin_create_sponsor(
  p_name text,
  p_emails text[],
  p_category_ids uuid[],
  p_perks text[],
  p_website_url text,
  p_logo_url text default null,
  p_logo_source text default 'favicon'
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

  if coalesce(trim(p_website_url), '') = '' then
    raise exception 'Company website URL is required';
  end if;

  if p_logo_source not in ('favicon', 'custom') then
    raise exception 'Invalid logo source';
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

  insert into public.sponsors (name, slug, website_url, logo_url, logo_source)
  values (trim(p_name), v_slug, trim(p_website_url), p_logo_url, p_logo_source)
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

revoke all on function public.admin_create_sponsor(text, text[], uuid[], text[], text, text, text) from public, anon;
grant execute on function public.admin_create_sponsor(text, text[], uuid[], text[], text, text, text) to authenticated;
