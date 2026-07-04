-- ---------------------------------------------------------------------
-- Username à partir du nom fourni par le provider (Google : full_name / name).
-- Pour une inscription email classique, raw_user_meta_data ne contient pas de
-- nom -> on retombe sur le préfixe de l'email (comportement inchangé).
-- ---------------------------------------------------------------------
begin;

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_name text;
begin
  -- Nom du provider si présent (Google), sinon préfixe de l'email.
  v_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );
  insert into public.profiles (id, email, username, is_admin)
  values (
    new.id,
    new.email,
    v_name,
    new.email = any (array['ngoransebastjunior@gmail.com'])
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Rattrapage : renseigne le vrai nom pour les comptes déjà créés via un
-- provider, UNIQUEMENT si le username est resté la valeur par défaut (préfixe
-- email) -> on ne touche pas aux noms personnalisés par l'utilisateur.
update public.profiles p
set username = nm.name
from auth.users u
cross join lateral (
  select coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', '')
  ) as name
) nm
where u.id = p.id
  and nm.name is not null
  and p.username = split_part(p.email, '@', 1);

commit;
