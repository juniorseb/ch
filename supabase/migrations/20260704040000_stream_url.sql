-- ---------------------------------------------------------------------
-- Écoute en avant-première : URL de flux (SunoAPI streamAudioUrl) disponible
-- ~30-40 s avant le MP3 final. On la mémorise pour l'afficher pendant que la
-- version téléchargeable se finalise. (Vide pour ApiPass, qui n'expose pas de flux.)
-- ---------------------------------------------------------------------
begin;
alter table song_generations add column if not exists stream_url text;
commit;
