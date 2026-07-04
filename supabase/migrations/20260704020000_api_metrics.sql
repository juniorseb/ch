-- ---------------------------------------------------------------------
-- Suivi technique : un enregistrement par APPEL d'API externe (OpenRouter,
-- Groq, ApiPass, Resend, GeniusPay), avec succès/échec. Écrit par les Edge
-- Functions (service_role) ; lu agrégé via admin-api. Aucune policy -> deny.
-- ---------------------------------------------------------------------
begin;

create table if not exists api_calls (
  id uuid primary key default gen_random_uuid(),
  api text not null,
  ok boolean not null default true,
  status int,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_calls_created on api_calls (created_at desc);
create index if not exists idx_api_calls_api on api_calls (api);
alter table api_calls enable row level security;

-- Agrégation efficace (count + erreurs) par API sur une période. SECURITY
-- DEFINER, réservé à service_role (via admin-api qui vérifie is_admin).
create or replace function api_metrics(since timestamptz)
returns table (api text, total bigint, errors bigint)
language sql stable security definer set search_path = public as $$
  select api,
         count(*)::bigint as total,
         count(*) filter (where not ok)::bigint as errors
  from api_calls
  where created_at >= since
  group by api;
$$;

revoke all on function api_metrics(timestamptz) from public, anon, authenticated;
grant execute on function api_metrics(timestamptz) to service_role;

commit;
