// supabase/functions/preview-lyrics/index.ts
// Génère un APERÇU des paroles à partir du brouillon, AVANT toute création de
// compte ou paiement (moment de valeur du funnel). Public, sans auth, n'écrit
// rien en base : renvoie juste le texte. La chanson n'est créée qu'ensuite,
// au moment de générer la musique.
// Secrets : OPENROUTER_API_KEY (principal, gpt-4o-mini), GROQ_API_KEY (secours).
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
  anniversaire: 'pour un anniversaire',
  amour: "pour une déclaration d'amour",
  mariage: 'pour un mariage',
  autre: 'pour une occasion spéciale',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { draft, improve } = await req.json()
    if (!draft) return jsonResponse({ error: 'Détails manquants' }, 400)

    const rawLang = String(draft.customLanguage || draft.language || 'francais').trim() || 'francais'
    const lang = LANG_LABEL[rawLang] ?? `en ${rawLang}`
    const styleTxt = (draft.customStyle || draft.style)
      ? `style ${draft.customStyle || draft.style}`
      : 'style au choix, adapté au message'
    const voice =
      draft.voice === 'femme' ? 'chantée par une voix féminine'
      : draft.voice === 'homme' ? 'chantée par une voix masculine'
      : draft.voice === 'duo' ? 'chantée en duo homme-femme'
      : ''

    // Mode "améliorer" : on part des paroles de l'utilisateur, on les
    // restructure/embellit SANS changer leur sens, leurs idées ni les noms.
    const prompt = improve
      ? [
          `Améliore et structure ces paroles de chanson, ${lang}, ${styleTxt}${draft.ambiance ? `, ambiance ${draft.ambiance}` : ''}.`,
          voice ? `La chanson sera ${voice}.` : '',
          'Garde le sens, les idées, les prénoms et le message d\'origine ; améliore les rimes, le rythme et la fluidité.',
          `Structure avec les balises de section exactement entre crochets : ${STRUCTURE}.`,
          "N'utilise QUE les noms et prénoms présents dans le texte d'origine ci-dessous ; n'invente ni n'ajoute aucun autre nom.",
          'Réponds uniquement avec les paroles finales.',
          `Paroles d'origine :\n${draft.ownLyrics ?? ''}`,
        ].filter(Boolean).join(' ')
      : [
          `Écris des paroles de chanson ${lang}, ${styleTxt}${draft.ambiance ? `, ambiance ${draft.ambiance}` : ''}, ${OCCASION_LABEL[String(draft.occasion)] ?? ''}.`,
          voice ? `La chanson sera ${voice}.` : '',
          `Destinataire : ${draft.recipientName}${draft.relation ? ` (${draft.relation})` : ''}.`,
          draft.senderName ? `Offerte par : ${draft.senderName}.` : '',
          draft.marriageType ? `Type de mariage : ${draft.marriageType}.` : '',
          draft.meetContext ? `Contexte : ${draft.meetContext}.` : '',
          draft.story ? `Message / histoire : ${draft.story}.` : '',
          `Structure obligatoire, avec les balises de section exactement entre crochets : ${STRUCTURE}.`,
          `Le destinataire est nommé "${draft.recipientName}" (ce peut être un prénom OU un petit nom affectueux comme « ma biche », « mon cœur » : utilise-le tel quel, naturellement).`,
          `Dès l'intro, cite ce nom "${draft.recipientName}"${draft.senderName ? ` et celui de ${draft.senderName} (la personne qui offre la chanson)` : ''}.`,
          `Termine aussi l'outro en citant "${draft.recipientName}".`,
        ].filter(Boolean).join(' ')

    try {
      const lyrics = await generateLyricsText(prompt)
      return jsonResponse({ lyrics })
    } catch {
      // Aucun fournisseur activé/disponible.
      // En mode "améliorer", on renvoie les paroles de l'utilisateur telles quelles
      // (jamais un nom fabriqué à partir d'un brouillon précédent).
      if (improve) return jsonResponse({ lyrics: String(draft.ownLyrics ?? '') })
      // Aperçu de secours minimal (flow guidé).
      const fallback = [
        '[Intro]', String(draft.recipientName ?? ''), String(draft.story ?? ''), '', '[Refrain]',
        `${draft.recipientName}, ${draft.ambiance ?? ''}`, '', '[Outro]', String(draft.recipientName),
      ].join('\n')
      return jsonResponse({ lyrics: fallback })
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
