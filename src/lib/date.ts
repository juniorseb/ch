// Formate une date ISO (created_at Postgres) en date française lisible :
// « 3 juillet 2026 ». Renvoie une chaîne vide si la date est absente/invalide.
export function formatSongDate(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
