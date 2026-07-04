// supabase/functions/delete-song/index.ts
// Supprime définitivement une chanson de l'utilisateur connecté : on vérifie la
// propriété via le JWT (la RLS de select ne renvoie que ses lignes), on efface
// les fichiers audio ré-hébergés dans le bucket 'songs', puis on supprime la
// ligne song_generations avec le client service_role.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

// D'une URL publique de stockage, extrait le chemin de l'objet dans le bucket
// 'songs' (ex. ".../object/public/songs/<id>_0.mp3" -> "<id>_0.mp3").
function storagePath(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = '/storage/v1/object/public/songs/'
  const i = url.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0])
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Non authentifié' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return jsonResponse({ error: 'Session invalide' }, 401)

    const { songGenerationId } = await req.json()
    if (!songGenerationId) return jsonResponse({ error: 'Chanson manquante' }, 400)

    // Lecture avec le client utilisateur : la RLS garantit qu'il ne peut voir
    // (et donc supprimer) que SES chansons.
    const { data: song } = await userClient
      .from('song_generations')
      .select('id, audio_url, audio_url_2')
      .eq('id', songGenerationId)
      .maybeSingle()

    if (!song) return jsonResponse({ error: 'Chanson introuvable' }, 404)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Nettoyage best-effort des fichiers audio ré-hébergés (n'échoue pas la
    // suppression si le storage renvoie une erreur).
    const paths = [storagePath(song.audio_url), storagePath(song.audio_url_2)].filter(Boolean) as string[]
    if (paths.length > 0) {
      try {
        await admin.storage.from('songs').remove(paths)
      } catch (e) {
        console.error('[delete-song] nettoyage storage échoué:', String(e))
      }
    }

    const { error: delError } = await admin
      .from('song_generations')
      .delete()
      .eq('id', songGenerationId)
    if (delError) return jsonResponse({ error: delError.message }, 500)

    return jsonResponse({ ok: true })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
