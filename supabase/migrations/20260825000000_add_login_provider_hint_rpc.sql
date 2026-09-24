-- Returns the auth providers linked to an email and whether the user can
-- sign in with a password. Used by the login-provider-hint edge function to
-- guide users whose account was created via Apple/Google OAuth back to the
-- correct login method.
create or replace function public.get_login_provider_hint(p_email text)
returns json
language sql
stable
security definer
set search_path = auth, public
as $$
  select json_build_object(
    'providers',
    (
      select coalesce(json_agg(p.provider), '[]'::json)
      from (
        select i.provider,
               max(i.created_at) as last_used_at
        from auth.identities i
        join auth.users u on u.id = i.user_id
        where lower(u.email) = lower(p_email)
          and i.provider in ('apple', 'google')
        group by i.provider
        order by max(i.created_at) desc
      ) p
    ),
    'has_password',
    coalesce(
      (
        select bool_or(
          u.encrypted_password is not null and u.encrypted_password <> ''
        )
        from auth.users u
        where lower(u.email) = lower(p_email)
      ),
      false
    )
  );
$$;

revoke execute on function public.get_login_provider_hint(text) from public;
grant execute on function public.get_login_provider_hint(text)
  to anon, authenticated;
