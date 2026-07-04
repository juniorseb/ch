-- ---------------------------------------------------------------------
-- Analyse comportementale : chaque étape du parcours (visite de l'accueil,
-- choix d'occasion, paroles vues, compte, paiement, génération…) émet un
-- événement. Les visiteurs anonymes sont suivis via un identifiant client
-- (visitor_id, stocké en localStorage) ; user_id est renseigné une fois
-- connecté. Insertion via Edge Function `track` (service_role) ; lecture
-- agrégée via admin-api. Aucune policy publique -> deny par défaut.
-- ---------------------------------------------------------------------
begin;

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  event text not null,
  path text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_created on analytics_events (created_at desc);
create index if not exists idx_analytics_event on analytics_events (event);
create index if not exists idx_analytics_visitor on analytics_events (visitor_id);

alter table analytics_events enable row level security;
-- Aucune policy : insertion et lecture uniquement via service_role (Edge
-- Functions). Le public ne peut ni lire ni écrire directement.

commit;
