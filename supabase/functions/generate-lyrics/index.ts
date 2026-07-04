// supabase/functions/generate-lyrics/index.ts
// Déclenchée par geniuspay-webhook une fois le paiement confirmé. Génère
// des paroles structurées avec des balises de section ([Intro], [Couplet
// 1], [Refrain]...), s'arrête à status='lyrics_ready' et diffuse le
// résultat en Realtime -- l'utilisateur peut ensuite les relire et les
// modifier avant de lancer la génération audio (voir generate-audio).
// Secrets : OPENROUTER_API_KEY (principal, gpt-4o-mini), GROQ_API_KEY (secours).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { generateLyricsText } from '../_shared/lyrics.ts'

const STRUCTURE = '[Intro], [Couplet 1], [Refrain], [Couplet 2], [Refrain], [Pont], [Refrain final], [Outro]'

const LANG_LABEL: Record<string, string> = {
  francais: 'en français',
  anglais: 'en anglais',
  mix: 'en mélangeant français et anglais',
  lingala: 'en mélangeant lingala et français',
  nouchi: 'en français avec des expressions nouchi (argot ivoirien)',
}

const OCCASION_LABEL: Record<string, string> = {
  anniversaire: "pour un anniversaire",
  amour: "pour une déclaration d'amour",
  mariage: 'pour un mariage',
  autre: 'pour une occasion spéciale',
}

async function generateLyrics(song: Record<string, unknown>): Promise<string> {
  // Langue connue -> libellé dédié ; langue libre (ex. bambara, wolof) -> on
  // l'utilise telle quelle.
  const rawLang = String(song.language ?? 'francais').trim() || 'francais'
  const lang = LANG_LABEL[rawLang] ?? `en ${rawLang}`
  const style = song.style ? `style ${song.style}` : 'style au choix, adapté au message'
  const voice =
    song.voice === 'femme' ? 'chantée par une voix féminine'
    : song.voice === 'homme' ? 'chantée par une voix masculine'
    : song.voice === 'duo' ? 'chantée en duo homme-femme'
    : ''

  const prompt = [
    `Écris des paroles de chanson ${lang}, ${style}${song.ambiance ? `, ambiance ${song.ambiance}` : ''}, ${OCCASION_LABEL[String(song.occasion)] ?? ''}.`,
    voice ? `La chanson sera ${voice}.` : '',
    `Destinataire : ${song.recipient_name}${song.relation ? ` (${song.relation})` : ''}.`,
    song.sender_name ? `Offerte par : ${song.sender_name}.` : '',
    song.marriage_type ? `Type de mariage : ${song.marriage_type}.` : '',
    song.meet_context ? `Contexte : ${song.meet_context}.` : '',
    song.story ? `Message / histoire : ${song.story}.` : '',
    `Structure obligatoire, avec les balises de section exactement entre crochets : ${STRUCTURE}.`,
    `Le destinataire est nommé "${song.recipient_name}" (ce peut être un prénom OU un petit nom affectueux comme « ma biche », « mon cœur » : utilise-le tel quel, naturellement).`,
    `Dès l'intro, cite ce nom "${song.recipient_name}"${song.sender_name ? ` et celui de ${song.sender_name} (la personne qui offre la chanson)` : ''}.`,
    `Termine aussi l'outro en citant "${song.recipient_name}".`,
  ].filter(Boolean).join(' ')

  try {
    return await generateLyricsText(prompt)
  } catch {
    // Aucun fournisseur activé/disponible : structure de secours pour que le
    // pipeline ne casse pas complètement.
    return [
      '[Intro]',
      `${song.recipient_name}`,
      `${song.story ?? ''}`,
      '',
      '[Refrain]',
      `${song.recipient_name}, ${song.ambiance ?? ''}`,
      '',
      '[Outro]',
      `${song.recipient_name}`,
    ].join('\n')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { songGenerationId } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const channel = supabase.channel(`song:${songGenerationId}`)

    const { data: song, error } = await supabase
      .from('song_generations')
      .select('*')
      .eq('id', songGenerationId)
      .single()
    if (error || !song) return jsonResponse({ error: 'Chanson introuvable' }, 404)

    await channel.send({ type: 'broadcast', event: 'status', payload: { status: 'generating_lyrics' } })

    const lyrics = await generateLyrics(song)

    await supabase
      .from('song_generations')
      .update({ lyrics, status: 'lyrics_ready' })
      .eq('id', songGenerationId)

    await channel.send({ type: 'broadcast', event: 'status', payload: { status: 'lyrics_ready', lyrics } })

    return jsonResponse({ status: 'lyrics_ready', lyrics })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
