-- Migration Mamélodie : passage au système de crédits + parcours de création
-- enrichi (styles ouverts, voix/ambiance/langue, questions par occasion).
--
-- À exécuter sur une base créée avec l'ANCIEN schéma (packs 'unite'/'decouverte',
-- song_generations lié à payment_id, vue payment_credits).
-- Sur une base neuve, schema.sql suffit ; cette migration est idempotente et
-- peut être rejouée sans risque.
--
-- Après cette migration, redéployer les Edge Functions :
--   create-payment, create-song, generate-lyrics, generate-audio, geniuspay-webhook

begin;

-- ---------------------------------------------------------------------
-- 1) payments : pack -> crédits (tier_id + credits_purchased)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'payments' and column_name = 'pack_id'
  ) then
    -- l'ancienne contrainte limitait pack_id à ('unite','decouverte')
    alter table payments drop constraint if exists payments_pack_id_check;
    alter table payments rename column pack_id to tier_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'payments' and column_name = 'songs_included'
  ) then
    alter table payments rename column songs_included to credits_purchased;
  end if;
end $$;

-- Autorise amount_fcfa = 0 (crédits offerts par l'admin).
alter table payments drop constraint if exists payments_amount_fcfa_check;
alter table payments add constraint payments_amount_fcfa_check check (amount_fcfa >= 0);

-- Le numéro de téléphone est désormais optionnel (saisi chez l'agrégateur).
alter table payments alter column phone drop not null;

-- ---------------------------------------------------------------------
-- 2) song_generations : découplage du paiement + styles ouverts + champs
-- ---------------------------------------------------------------------
-- 2a. On retire le lien direct vers un paiement (le solde est global).
alter table song_generations drop constraint if exists song_generations_payment_id_fkey;
drop index if exists idx_song_generations_payment;
alter table song_generations drop column if exists payment_id;

-- 2b. Le style devient libre (Suno accepte n'importe quel style).
alter table song_generations drop constraint if exists song_generations_style_check;
alter table song_generations alter column style drop not null;

-- 2c. Nouveaux champs du parcours enrichi.
alter table song_generations add column if not exists sender_name text;
alter table song_generations add column if not exists marriage_type text;
alter table song_generations add column if not exists meet_context text;
alter table song_generations add column if not exists voice text;
alter table song_generations add column if not exists ambiance text;
alter table song_generations add column if not exists language text;
alter table song_generations add column if not exists download_count integer not null default 0;
-- (l'ancienne colonne `tone` est laissée en place si elle existe : inutilisée,
--  mais sa suppression n'apporte rien et ferait perdre d'éventuelles données.)

-- ---------------------------------------------------------------------
-- 3) Vue de crédits : payment_credits -> user_credits
-- ---------------------------------------------------------------------
drop view if exists payment_credits;

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
-- 4) Panel admin : réglages globaux + profils/rôle admin
-- ---------------------------------------------------------------------
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value)
  values
    ('otp_enabled', 'true'),
    ('lyrics_openai_enabled', 'true'),
    ('lyrics_groq_enabled', 'true'),
    ('lyrics_primary', 'openai'),
    ('music_apipass_enabled', 'true'),
    ('geniuspay_sandbox', 'false')
  on conflict (key) do nothing;

-- app_secrets : secrets sensibles (clés prestataires) éditables depuis l'admin.
-- Aucune policy de lecture -> seul le service_role y accède.
create table if not exists app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_secrets enable row level security;

-- feedback : avis / suggestions des utilisateurs (lecture réservée à l'admin).
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  rating int check (rating between 1 and 5),
  message text not null,
  created_at timestamptz not null default now()
);
alter table feedback enable row level security;
drop policy if exists "Chacun dépose son avis" on feedback;
create policy "Chacun dépose son avis" on feedback for insert with check (auth.uid() = user_id);

-- Bucket public pour ré-héberger l'audio généré (lien sur notre domaine).
insert into storage.buckets (id, name, public)
  values ('songs', 'songs', true)
  on conflict (id) do nothing;

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- Au cas où profiles existait déjà sans ces colonnes.
alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists suspended boolean not null default false;
alter table profiles add column if not exists username text;
update profiles set username = split_part(email, '@', 1) where username is null;

create or replace function set_username(p_username text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update public.profiles set username = p_username where id = auth.uid();
end;
$$;

create or replace function record_download(p_song uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update public.song_generations
    set download_count = download_count + 1
    where id = p_song and user_id = auth.uid();
end;
$$;

-- Rattrape les comptes déjà existants (créés avant la table profiles).
insert into profiles (id, email)
  select id, email from auth.users
  on conflict (id) do nothing;

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

update profiles set is_admin = true where email = 'ngoransebastjunior@gmail.com';

alter table app_settings enable row level security;
alter table profiles enable row level security;

drop policy if exists "Lecture des réglages" on app_settings;
create policy "Lecture des réglages" on app_settings for select using (true);

drop policy if exists "Lecture de son profil" on profiles;
create policy "Lecture de son profil" on profiles for select using (auth.uid() = id);

commit;
