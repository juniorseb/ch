-- ---------------------------------------------------------------------
-- Agrégation efficace du funnel côté base (au lieu de parcourir les lignes
-- en JS). count(distinct visitor_id) par événement sur une période.
-- SECURITY DEFINER + droits restreints à service_role : seule l'Edge Function
-- admin-api (qui vérifie is_admin) peut appeler ces fonctions. Empêche qu'un
-- simple utilisateur connecté lise les stats via l'API PostgREST.
-- ---------------------------------------------------------------------
begin;

create or replace function analytics_funnel(since timestamptz)
returns table (event text, visitors bigint, total bigint)
language sql stable security definer set search_path = public as $$
  select event,
         count(distinct visitor_id)::bigint as visitors,
         count(*)::bigint as total
  from analytics_events
  where created_at >= since
  group by event;
$$;

create or replace function analytics_unique_visitors(since timestamptz)
returns bigint
language sql stable security definer set search_path = public as $$
  select count(distinct visitor_id)::bigint
  from analytics_events
  where created_at >= since;
$$;

-- Restreint l'exécution à service_role uniquement. NB : Supabase accorde par
-- défaut EXECUTE à anon/authenticated ; `revoke from public` ne suffit pas, il
-- faut révoquer explicitement ces rôles, sinon un simple utilisateur connecté
-- pourrait lire les stats via l'API PostgREST (/rest/v1/rpc/...).
revoke all on function analytics_funnel(timestamptz) from public, anon, authenticated;
revoke all on function analytics_unique_visitors(timestamptz) from public, anon, authenticated;
grant execute on function analytics_funnel(timestamptz) to service_role;
grant execute on function analytics_unique_visitors(timestamptz) to service_role;

commit;
