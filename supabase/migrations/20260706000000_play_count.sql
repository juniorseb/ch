-- Suivi des écoutes de chansons (à l'image des téléchargements). Un compteur
-- par chanson, incrémenté à la première lecture d'une session de lecteur.
alter table song_generations add column if not exists play_count integer not null default 0;

-- security definer (contourne l'absence de policy UPDATE), borné au propriétaire
-- de la chanson : chacun n'incrémente que ses propres écoutes.
create or replace function record_play(p_song uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  update public.song_generations
    set play_count = play_count + 1
    where id = p_song and user_id = auth.uid();
end;
$$;
