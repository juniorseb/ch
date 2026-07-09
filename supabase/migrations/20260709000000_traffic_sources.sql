-- Sources de trafic : agrégation en base des points d'entrée (événements
-- portant une source dans meta : landing / signup_view / login_view), pour
-- savoir d'où viennent les visiteurs (Facebook via ?fbclid, Google, WhatsApp,
-- referral, direct…). count(distinct visitor_id) -> visiteurs uniques par
-- source (dédoublonné même si un visiteur a plusieurs événements d'entrée, la
-- source étant figée « first-touch »).
create or replace function traffic_sources(since timestamptz)
returns table(source text, visitors bigint, events bigint)
language sql stable security definer
set search_path = public as $$
  select
    coalesce(nullif(meta->>'source', ''), 'direct') as source,
    count(distinct visitor_id) as visitors,
    count(*) as events
  from analytics_events
  where meta ? 'source' and created_at >= since
  group by 1
  order by visitors desc, events desc;
$$;

-- Réservée au service_role (appelée depuis l'Edge Function admin-api).
revoke all on function traffic_sources(timestamptz) from public, anon, authenticated;
grant execute on function traffic_sources(timestamptz) to service_role;
