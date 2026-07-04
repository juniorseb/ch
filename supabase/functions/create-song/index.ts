// supabase/functions/create-song/index.ts
// Crée une chanson en consommant un crédit déjà disponible, sans paiement.
// Appelée par le frontend quand le solde de l'utilisateur est >= 1 (on saute
// alors l'écran de paiement). Le solde est revérifié ici côté serveur (source
// de vérité, via la vue user_credits) pour qu'un client ne puisse pas forcer
// une génération sans crédit. Insère la ligne song_generations en
// generating_lyrics puis déclenche generate-lyrics en tâche de fond.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { generateSongTitle } from '../_shared/lyrics.ts'

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

    const { draft } = await req.json()
    if (!draft) return jsonResponse({ error: 'Détails de chanson manquants' }, 400)

    // Solde lu avec le client utilisateur : la vue user_credits (security
    // invoker) ne renvoie que la ligne de l'appelant.
    const { data: credit } = await userClient
      .from('user_credits')
      .select('credits_balance')
      .maybeSingle()

    if ((credit?.credits_balance ?? 0) < 1) {
      return jsonResponse({ error: 'Solde de crédits insuffisant' }, 402)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Les paroles ont déjà été générées/éditées côté client (aperçu) : on les
    // enregistre et on lance directement la génération de la MUSIQUE.
    const lyrics = String(draft.lyrics ?? draft.ownLyrics ?? '').trim()

    // Titre : celui saisi par l'utilisateur ; sinon on le fait proposer par
    // l'IA à partir des paroles finales (appel léger). Repli neutre si l'IA
    // n'aboutit pas (jamais de « Pour » vide quand il n'y a pas de destinataire).
    let title = (draft.songTitle && String(draft.songTitle).trim()) || ''
    if (!title) title = await generateSongTitle(lyrics)
    if (!title) {
      const rn = (draft.recipientName && String(draft.recipientName).trim()) || ''
      title = rn ? `Pour ${rn}` : 'Ma chanson'
    }

    const { data: song, error: songError } = await supabase
      .from('song_generations')
      .insert({
        user_id: user.id,
        occasion: draft.occasion,
        recipient_name: draft.recipientName,
        sender_name: draft.senderName ?? null,
        relation: draft.relation ?? null,
        marriage_type: draft.marriageType ?? null,
        meet_context: draft.meetContext ?? null,
        style: draft.customStyle || draft.style || null,
        voice: draft.voice ?? null,
        ambiance: draft.ambiance ?? null,
        language: (draft.customLanguage && draft.customLanguage.trim()) || draft.language || null,
        story: draft.story ?? null,
        lyrics: lyrics || null,
        title,
        status: 'generating_audio',
      })
      .select()
      .single()

    if (songError) return jsonResponse({ error: songError.message }, 500)

    // Déclenche generate-audio (crée la tâche ApiPass). generate-audio est
    // désormais court (crée la tâche puis rend la main) : on l'attend pour
    // GARANTIR le déclenchement et journaliser le résultat (diagnostic).
    const genUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-audio`
    try {
      const r = await fetch(genUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ songGenerationId: song.id }),
      })
      const text = await r.text()
      console.log(`[create-song] generate-audio (${genUrl}) -> ${r.status}: ${text.slice(0, 300)}`)
    } catch (e) {
      // L'appel interne a échoué (ex. URL/kong injoignable) : on marque la
      // chanson en échec pour ne pas laisser le frontend attendre sans fin.
      console.error(`[create-song] appel generate-audio échoué (${genUrl}):`, String(e))
      await supabase
        .from('song_generations')
        .update({ status: 'failed', error_message: 'Impossible de lancer la génération musicale.' })
        .eq('id', song.id)
    }

    return jsonResponse({ songGenerationId: song.id })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
