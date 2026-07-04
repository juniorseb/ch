// Génération des paroles avec chaîne de fournisseurs configurable.
//
// Fournisseur principal : gpt-4o-mini via OpenRouter. Secours : Groq
// (llama-3.3). Chaque fournisseur est activable indépendamment depuis le panel
// admin (app_settings). L'ordre suit `lyrics_primary` ; si le principal est
// désactivé ou échoue, on bascule automatiquement sur le suivant activé.
//
// Secrets : OPENROUTER_API_KEY (principal), GROQ_API_KEY (secours).
import { loadSettings, settingBool, settingStr } from './settings.ts'
import { loadSecrets, secretOrEnv } from './secrets.ts'
import { recordApiCall } from './metrics.ts'

export interface LyricsSettings {
  openaiEnabled: boolean
  groqEnabled: boolean
  primary: 'openai' | 'groq'
}

export async function loadLyricsSettings(): Promise<LyricsSettings> {
  const s = await loadSettings()
  return {
    openaiEnabled: settingBool(s, 'lyrics_openai_enabled', true),
    groqEnabled: settingBool(s, 'lyrics_groq_enabled', true),
    primary: settingStr(s, 'lyrics_primary', 'openai') === 'groq' ? 'groq' : 'openai',
  }
}

// gpt-4o-mini via OpenRouter (API compatible OpenAI). HTTP-Referer / X-Title
// servent à l'attribution de l'app côté OpenRouter.
async function callOpenRouter(prompt: string, key: string): Promise<string> {
  if (!key) throw new Error('Clé OpenRouter manquante')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mamelodie.net',
      'X-Title': 'Mamélodie',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 700,
      temperature: 0.9,
    }),
  })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('OpenRouter : réponse vide')
  return text
}

async function callGroq(prompt: string, key: string): Promise<string> {
  if (!key) throw new Error('Clé Groq manquante')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 700,
    }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Groq : réponse vide')
  return text
}

// Génère les paroles en essayant les fournisseurs activés, dans l'ordre
// (principal puis secours). Lève une erreur seulement si tous échouent.
export async function generateLyricsText(prompt: string, settings?: LyricsSettings): Promise<string> {
  const s = settings ?? (await loadLyricsSettings())
  const order: Array<'openai' | 'groq'> = s.primary === 'groq' ? ['groq', 'openai'] : ['openai', 'groq']
  const active = order.filter((p) => (p === 'openai' ? s.openaiEnabled : s.groqEnabled))
  if (active.length === 0) throw new Error('Aucun fournisseur de paroles activé')

  // Clés depuis l'admin (app_secrets) avec repli sur les variables d'env.
  const secrets = await loadSecrets()
  const orKey = secretOrEnv(secrets, 'openrouter_api_key', 'OPENROUTER_API_KEY')
  const groqKey = secretOrEnv(secrets, 'groq_api_key', 'GROQ_API_KEY')

  let lastErr: unknown
  for (const p of active) {
    const apiName = p === 'openai' ? 'openrouter' : 'groq'
    try {
      const text = p === 'openai' ? await callOpenRouter(prompt, orKey) : await callGroq(prompt, groqKey)
      console.log(`[lyrics] généré via ${p === 'openai' ? 'OpenRouter (gpt-4o-mini)' : 'Groq'}`)
      await recordApiCall(apiName, true)
      return text
    } catch (err) {
      lastErr = err
      await recordApiCall(apiName, false)
      // On journalise pour comprendre un basculement (clé manquante, 401, etc.)
      // puis on tente le fournisseur suivant.
      console.error(`[lyrics] fournisseur "${p}" a échoué -> secours:`, String(err))
    }
  }
  throw lastErr ?? new Error('Échec de génération des paroles')
}

// Nettoie la réponse de l'IA pour en faire un titre présentable : première
// ligne, sans guillemets/étiquette/ponctuation superflue, longueur bornée.
function sanitizeTitle(raw: string): string {
  let t = (raw || '').split('\n')[0].trim()
  t = t.replace(/^["'«»\s]+|["'«»\s]+$/g, '') // guillemets en bord
  t = t.replace(/^(titre\s*[:\-–]\s*)/i, '')  // préfixe "Titre :"
  t = t.replace(/[.。]+$/,'').trim()           // point final
  if (t.length > 60) t = t.slice(0, 60).trim()
  return t
}

// Propose un titre court à partir des paroles finales. Appel très léger
// (quelques tokens en sortie) : coût et latence négligeables. Renvoie une
// chaîne vide si aucun fournisseur n'aboutit (l'appelant gère le repli).
export async function generateSongTitle(lyrics: string): Promise<string> {
  const body = (lyrics || '').trim()
  if (!body) return ''
  const prompt = [
    'Propose un TITRE court et accrocheur (2 à 5 mots) pour cette chanson.',
    'Réponds UNIQUEMENT par le titre, sans guillemets, sans ponctuation finale, sans le mot « Titre ».',
    `Paroles :\n${body.slice(0, 1500)}`,
  ].join(' ')
  try {
    return sanitizeTitle(await generateLyricsText(prompt))
  } catch (err) {
    console.error('[title] génération du titre échouée:', String(err))
    return ''
  }
}
