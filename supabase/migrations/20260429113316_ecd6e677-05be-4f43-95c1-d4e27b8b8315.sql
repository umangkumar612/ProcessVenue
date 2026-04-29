
-- has_role is called by RLS policies which run as the invoker; revoke direct API access
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Re-set search_path explicitly (already set, but ensure linter sees it)
alter function public.has_role(uuid, public.app_role) set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
