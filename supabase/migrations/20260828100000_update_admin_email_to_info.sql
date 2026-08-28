create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.jwt_email() = 'info@uwblueprint.org'
$$;

alter function public.is_admin() set search_path = public;