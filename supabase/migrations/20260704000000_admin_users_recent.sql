-- ---------------------------------------------------------------------
-- Liste admin des utilisateurs triée par DERNIÈRE CONNEXION (last_sign_in_at,
-- qui vit dans auth.users). Jointure profiles + auth.users, tri + pagination
-- faits en base. SECURITY DEFINER (accès à auth.users) + exécution restreinte
-- à service_role : seule l'Edge Function admin-api (qui vérifie is_admin) peut
-- appeler cette fonction. `total_count` (window) évite une 2e requête de count.
-- ---------------------------------------------------------------------
begin;

create or replace function admin_users_by_recent(p_limit int, p_offset int)
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  suspended boolean,
  total_count bigint
)
language sql stable security definer set search_path = public, auth as $$
  select
    p.id,
    p.email,
    p.created_at,
    u.last_sign_in_at,
    coalesce(p.suspended, false) as suspended,
    count(*) over() as total_count
  from profiles p
  join auth.users u on u.id = p.id
  order by u.last_sign_in_at desc nulls last, p.created_at desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

revoke all on function admin_users_by_recent(int, int) from public, anon, authenticated;
grant execute on function admin_users_by_recent(int, int) to service_role;

commit;
