-- Schéma Mamélodie
-- À exécuter dans Supabase : Dashboard -> SQL Editor -> coller -> Run.
--
-- Identité : Supabase Auth (email + mot de passe), pas de login par
-- téléphone -- l'email fonctionne pour la diaspora et les numéros
-- internationaux, contrairement au SMS limité à la Côte d'Ivoire. Le
-- téléphone reste collecté, mais uniquement comme contact de paiement
-- mobile money (table payments), jamais comme identifiant de connexion.
--
-- Sécurité : RLS activée partout. song_generations et payments sont
-- lisibles par leur propriétaire (auth.uid() = user_id) -- exactement le
-- pattern qu'on a observé dans l'architecture de Musiki. Les écritures
-- (création, mise à jour de statut) passent uniquement par les Edge
-- Functions avec la clé service_role, qui contourne toujours RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- payments : un achat de crédits en FCFA via GeniusPay. Une seule grille
-- à prix dégressif (tier_id : c1/c4/c8/c18), chaque achat crédite
-- `credits_purchased` crédits. 1 crédit = 1 chanson. Le solde de
-- l'utilisateur est la somme des crédits achetés moins les chansons
-- générées (voir la vue user_credits) -- aucun crédit n'est rattaché à un
-- achat précis.
-- ---------------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Optionnel : le numéro est saisi par le client sur la page de l'agrégateur.
  phone text,
  tier_id text not null,
  credits_purchased integer not null check (credits_purchased > 0),
  -- 0 autorisé : crédits offerts par l'admin (tier_id = 'admin_gift').
  amount_fcfa integer not null check (amount_fcfa >= 0),
  geniuspay_reference text unique,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_user on payments (user_id);
create index if not exists idx_payments_reference on payments (geniuspay_reference);

-- ---------------------------------------------------------------------
-- song_generations : une chanson, du formulaire jusqu'aux deux versions
-- audio finales (Suno en génère toujours deux par appel). Chaque chanson
-- consomme 1 crédit ; elle n'est plus rattachée à un paiement précis (le
-- solde se calcule globalement, voir user_credits).
-- ---------------------------------------------------------------------
create table if not exists song_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occasion text not null check (occasion in ('anniversaire', 'amour', 'mariage', 'autre')),
  recipient_name text not null,
  sender_name text,
  relation text,
  marriage_type text,
  meet_context text,
  -- Style ouvert (Suno accepte tout : styles de la liste OU saisis à la main).
  style text,
  voice text,
  ambiance text,
  language text,
  story text,
  title text,
  lyrics text,
  audio_url text,
  audio_url_2 text,
  -- Flux d'écoute anticipée (SunoAPI) le temps que le MP3 final se prépare.
  stream_url text,
  download_count integer not null default 0,
  play_count integer not null default 0,
  suno_task_id text,
  -- Fournisseur musical ayant traité la tâche : 'sunoapi' ou 'apipass'.
  music_provider text,
  status text not null default 'pending_payment'
    check (status in (
      'pending_payment', 'generating_lyrics', 'lyrics_ready',
      'generating_audio', 'completed', 'failed'
    )),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_song_generations_user on song_generations (user_id);
create index if not exists idx_song_generations_status on song_generations (status);
create index if not exists idx_song_generations_created on song_generations (created_at desc);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_song_generations_updated_at on song_generations;
create trigger trg_song_generations_updated_at
  before update on song_generations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- email_otps : code à 4 chiffres envoyé pour confirmer l'email à
-- l'inscription (via Resend, voir send-email-otp). Volontairement séparé
-- du système de confirmation natif de Supabase pour garder le format à
-- 4 chiffres déjà validé dans les maquettes.
-- ---------------------------------------------------------------------
create table if not exists email_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_otps_user on email_otps (user_id);

create or replace function cleanup_expired_otps()
returns void language sql as $$
  delete from email_otps where expires_at < now() - interval '1 day';
$$;

-- ---------------------------------------------------------------------
-- user_credits : solde de crédits de l'utilisateur courant = crédits
-- achetés (paiements réussis) moins les chansons ayant réellement consommé
-- un crédit. Une seule ligne, celle de l'appelant (auth.uid()).
--
-- On NE dépend PAS de auth.users (non lisible par le rôle authenticated,
-- ce qui renverrait toujours 0). On filtre directement sur auth.uid().
--
-- "consommé" = chanson ni 'failed' (échec -> crédit rendu) ni
-- 'pending_payment' (achat pas encore réglé -> ne doit pas ponctionner le
-- solde ; sinon un achat abandonné fuiterait un crédit).
-- ---------------------------------------------------------------------
create or replace view user_credits
with (security_invoker = true) as
select
  user_id,
  credits_purchased,
  credits_consumed,
  credits_purchased - credits_consumed as credits_balance
from (
  select
    auth.uid() as user_id,
    coalesce((
      select sum(credits_purchased) from payments
      where user_id = auth.uid() and status = 'success'
    ), 0) as credits_purchased,
    coalesce((
      select count(*) from song_generations
      where user_id = auth.uid() and status not in ('failed', 'pending_payment')
    ), 0) as credits_consumed
) t;

grant select on user_credits to authenticated;

-- ---------------------------------------------------------------------
-- app_settings : réglages globaux pilotés depuis le panel admin
-- (ex. otp_enabled = 'true'/'false'). Lisible par tous (le flag OTP doit
-- être lu à l'inscription) ; écriture uniquement via Edge Function admin.
-- ---------------------------------------------------------------------
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value)
  values
    ('otp_enabled', 'true'),
    -- Fournisseurs (activables depuis le panel admin) :
    ('lyrics_openai_enabled', 'true'),  -- paroles : principal (gpt-4o-mini)
    ('lyrics_groq_enabled', 'true'),    -- paroles : secours (Llama 3.3)
    ('lyrics_primary', 'openai'),       -- ordre d'essai des fournisseurs
    ('music_apipass_enabled', 'true'),  -- musique : ApiPass (Suno)
    ('geniuspay_sandbox', 'false')      -- paiement : mode test (sandbox) vs live
  on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- app_secrets : SECRETS sensibles (clés d'API des prestataires) éditables
-- depuis l'admin. Contrairement à app_settings, cette table N'A AUCUNE policy
-- de lecture : seul le service_role (Edge Functions) y accède ; aucun client
-- (anon/authenticated) ne peut la lire. Écriture uniquement via admin-api.
-- ---------------------------------------------------------------------
create table if not exists app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_secrets enable row level security;
-- Aucune policy => inaccessible en lecture/écriture aux rôles anon/authenticated
-- (le service_role contourne toujours la RLS).

-- ---------------------------------------------------------------------
-- feedback : avis / suggestions laissés par les utilisateurs. Chacun peut
-- déposer le sien ; la lecture est réservée à l'admin (via admin-api).
-- ---------------------------------------------------------------------
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  rating int check (rating between 1 and 5),
  message text not null,
  created_at timestamptz not null default now()
);
alter table feedback enable row level security;
create policy "Chacun dépose son avis"
  on feedback for insert
  with check (auth.uid() = user_id);
-- Lecture réservée au service_role (admin-api) : aucune policy select.

-- ---------------------------------------------------------------------
-- Stockage : bucket public "songs" -> on ré-héberge l'audio généré chez nous
-- (lien sur notre domaine, indépendant du prestataire, persistant).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('songs', 'songs', true)
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- profiles : miroir léger de auth.users + rôle admin
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  username text,
  is_admin boolean not null default false,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- Modifier son propre nom d'utilisateur (uniquement le sien).
create or replace function set_username(p_username text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update public.profiles set username = p_username where id = auth.uid();
end;
$$;

-- Incrémente le compteur de téléchargements d'une chanson de l'appelant.
-- security definer pour contourner l'absence de policy UPDATE, mais borné
-- au propriétaire de la chanson.
create or replace function record_download(p_song uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update public.song_generations
    set download_count = download_count + 1
    where id = p_song and user_id = auth.uid();
end;
$$;

-- Incrémente le compteur d'écoutes d'une chanson de l'appelant (même principe
-- que record_download : security definer, borné au propriétaire).
create or replace function record_play(p_song uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update public.song_generations
    set play_count = play_count + 1
    where id = p_song and user_id = auth.uid();
end;
$$;

-- Crée automatiquement un profil à chaque inscription.
-- IMPORTANT : `security definer` + `set search_path = public` ET table
-- qualifiée `public.profiles` -- sinon le trigger, exécuté dans le contexte
-- de GoTrue (schéma auth), ne trouve pas la table (relation does not exist).
-- Emails administrateurs par défaut : leur profil est marqué is_admin dès
-- l'inscription (adapte la liste à tes gérants).
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, email, username, is_admin)
  values (new.id, new.email, split_part(new.email, '@', 1),
          new.email = any (array['ngoransebastjunior@gmail.com']))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Administrateur(s) initial(aux) -- à adapter à tes gérants.
update profiles set is_admin = true where email = 'ngoransebastjunior@gmail.com';

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table payments enable row level security;
alter table song_generations enable row level security;
alter table email_otps enable row level security;
alter table app_settings enable row level security;
alter table profiles enable row level security;

create policy "Lecture des réglages"
  on app_settings for select
  using (true);

create policy "Lecture de son profil"
  on profiles for select
  using (auth.uid() = id);

create policy "Lecture de ses propres chansons"
  on song_generations for select
  using (auth.uid() = user_id);

create policy "Lecture de ses propres paiements"
  on payments for select
  using (auth.uid() = user_id);

-- email_otps : aucune policy -> deny par défaut, accès uniquement via
-- service_role depuis les Edge Functions.

-- ---------------------------------------------------------------------
-- analytics_events : suivi comportemental du funnel (visiteurs anonymes +
-- connectés). Insertion via Edge Function `track`, lecture agrégée via
-- admin-api. Aucune policy -> accès service_role uniquement.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- api_calls : suivi technique (un enregistrement par appel d'API externe).
-- Écrit par les Edge Functions, lu agrégé via admin-api. Aucune policy.
-- ---------------------------------------------------------------------
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
