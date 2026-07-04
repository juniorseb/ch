-- ---------------------------------------------------------------------
-- Multi-fournisseurs musique : SunoAPI.org (principal) + ApiPass (secours).
-- On mémorise le fournisseur utilisé par chaque chanson (pour sonder/finaliser
-- avec le bon), et on seed les réglages (activation + ordre).
-- ---------------------------------------------------------------------
begin;

alter table song_generations add column if not exists music_provider text;

insert into app_settings (key, value) values
  ('music_sunoapi_enabled', 'true'),
  ('music_apipass_enabled', 'true'),
  ('music_primary', 'sunoapi'),
  ('music_sunoapi_model', 'V5_5')
on conflict (key) do nothing;

commit;
