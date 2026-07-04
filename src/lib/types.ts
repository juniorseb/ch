export type OccasionId = 'anniversaire' | 'amour' | 'mariage' | 'autre'

export interface Occasion {
  id: OccasionId
  label: string
  icon: 'cake' | 'heart' | 'confetti' | 'sparkles'
}

// Une seule grille de crédits à prix dégressif. 1 crédit = 1 chanson générée.
export interface CreditTier {
  id: string
  credits: number
  priceFcfa: number
  popular?: boolean
}

// Le style musical est ouvert (Suno accepte n'importe quel style) : on
// propose une palette locale riche + une saisie libre. `style` porte l'id
// choisi dans la liste ; `customStyle` porte un style tapé à la main.
export type MusicStyle = string

export type LyricsMode = 'guided' | 'own'

export interface SongDraft {
  occasion: OccasionId | null
  lyricsMode: LyricsMode
  // Destinataire & contexte (les champs utilisés dépendent de l'occasion)
  recipientName: string
  senderName: string
  relation: string
  marriageType: string
  meetContext: string
  story: string
  // Mode "j'ai déjà mes paroles"
  ownLyrics: string
  // Paroles finales (générées puis éventuellement éditées) portées jusqu'à
  // la génération de la musique.
  lyrics: string
  // Signature des entrées ayant produit `lyrics` : permet de retrouver les
  // mêmes paroles au retour (sans régénérer), et de ne régénérer que si les
  // détails/style ont réellement changé.
  lyricsSignature: string
  // Nombre de régénérations manuelles déjà consommées (plafonné, pour ne pas
  // épuiser les crédits IA en cliquant sans cesse sur « Régénérer »).
  lyricsRegenCount: number
  songTitle: string
  // Musique
  style: string
  customStyle: string
  voice: string
  ambiance: string
  language: string
  customLanguage: string
}

export type SongStatus =
  | 'pending_payment'
  | 'generating_lyrics'
  | 'lyrics_ready'
  | 'generating_audio'
  | 'completed'
  | 'failed'

export interface SongGeneration {
  id: string
  phone: string
  occasion: OccasionId
  recipientName: string
  style: string
  status: SongStatus
  title: string
  audioUrl?: string
  audioUrl2?: string
  createdAt: string
}

export const OCCASIONS: Occasion[] = [
  { id: 'anniversaire', label: 'Anniversaire', icon: 'cake' },
  { id: 'amour', label: 'Amour', icon: 'heart' },
  { id: 'mariage', label: 'Mariage', icon: 'confetti' },
  { id: 'autre', label: 'Autre', icon: 'sparkles' },
]

export const CREDIT_TIERS: CreditTier[] = [
  { id: 'c1', credits: 1, priceFcfa: 500 },
  { id: 'c4', credits: 4, priceFcfa: 1500 },
  { id: 'c8', credits: 8, priceFcfa: 2500, popular: true },
  { id: 'c18', credits: 18, priceFcfa: 5000 },
]

export function tierById(id: string): CreditTier | undefined {
  return CREDIT_TIERS.find((t) => t.id === id)
}

// Palette de styles. `popular: true` = affiché d'emblée ; le reste est sous
// « Plus de styles ». Rien n'est limité : l'utilisateur peut aussi taper le
// sien (customStyle).
export interface StyleOption {
  id: string
  label: string
  popular?: boolean
}

export const STYLES: StyleOption[] = [
  { id: 'afrobeat', label: 'Afrobeat', popular: true },
  { id: 'coupe-decale', label: 'Coupé-décalé', popular: true },
  { id: 'zouglou', label: 'Zouglou', popular: true },
  { id: 'gospel', label: 'Gospel', popular: true },
  { id: 'rumba', label: 'Rumba / Ndombolo', popular: true },
  { id: 'pop', label: 'Pop', popular: true },
  { id: 'rnb', label: 'R&B' },
  { id: 'reggae', label: 'Reggae' },
  { id: 'rap', label: 'Rap / Drill' },
  { id: 'slow', label: 'Slow / Ballade' },
  { id: 'mandingue', label: 'Mandingue' },
  { id: 'makossa', label: 'Makossa' },
  { id: 'bikutsi', label: 'Bikutsi' },
  { id: 'amapiano', label: 'Amapiano' },
  { id: 'zouk', label: 'Zouk' },
  { id: 'highlife', label: 'Highlife' },
  { id: 'traditionnel', label: 'Traditionnel' },
  { id: 'jazz', label: 'Jazz / Soul' },
  { id: 'variete', label: 'Variété' },
]

export function styleLabel(value: string): string {
  if (!value) return 'Automatique'
  return STYLES.find((s) => s.id === value)?.label ?? value
}

export const VOICES: { id: string; label: string; hint: string }[] = [
  { id: '', label: 'Automatique', hint: 'On choisit pour toi' },
  { id: 'femme', label: 'Femme', hint: 'Voix féminine' },
  { id: 'homme', label: 'Homme', hint: 'Voix masculine' },
  { id: 'duo', label: 'Duo', hint: 'Voix mixte' },
]

export const AMBIANCES: { id: string; label: string }[] = [
  { id: 'joyeuse', label: 'Joyeuse' },
  { id: 'emouvante', label: 'Émouvante' },
  { id: 'festive', label: 'Festive' },
  { id: 'douce', label: 'Douce' },
  { id: 'romantique', label: 'Romantique' },
  { id: 'energique', label: 'Énergique' },
]

export function ambianceLabel(value: string): string {
  return AMBIANCES.find((a) => a.id === value)?.label ?? value
}

export const LANGUAGES: { id: string; label: string }[] = [
  { id: 'francais', label: 'Français' },
  { id: 'anglais', label: 'Anglais' },
  { id: 'mix', label: 'Mix FR / EN' },
  { id: 'lingala', label: 'Lingala' },
  { id: 'nouchi', label: 'Nouchi' },
]

export const RELATIONS: string[] = [
  'Conjoint ou conjointe',
  'Amoureux ou amoureuse',
  'Ami ou amie',
  'Parent',
  'Enfant',
  'Frère ou sœur',
  'Collègue',
  'Famille',
  'Autre',
]

export const MARRIAGE_TYPES: { id: string; label: string; hint: string }[] = [
  { id: 'chretien', label: 'Chrétien', hint: 'Union devant Dieu, bénédictions' },
  { id: 'musulman', label: 'Musulman', hint: 'Union bénie par Allah' },
  { id: 'traditionnel', label: 'Dot / Traditionnel', hint: 'Traditions africaines' },
]
