alter function public.jwt_email() set search_path = public;
alter function public.is_blueprint() set search_path = public;
alter function public.is_admin() set search_path = public;
revoke all on function public.lock_member_identity() from public, anon, authenticated;