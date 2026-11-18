-- Admin rights only count after the two-step (authenticator app) code is verified, i.e. the
-- session is at assurance level aal2. A stolen admin password alone gets no admin access.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
