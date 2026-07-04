import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Shell from '../components/Shell'
import Button from '../components/Button'
import BackButton from '../components/BackButton'
import { useSongDraft } from '../lib/SongDraftContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { CREDIT_TIERS, type CreditTier } from '../lib/types'
import { getCreditTiers } from '../lib/settings'
import { createPayment } from '../lib/api/geniuspay'
import { addCreditsDemo, consumeCreditDemo } from '../lib/api/credits'
import { addDemoPayment } from '../lib/api/payments'

export default function Payment() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { draft, setSongGenerationId } = useSongDraft()
  // Grille chargée dynamiquement (pilotable depuis l'admin), défaut le temps du chargement.
  const [tiers, setTiers] = useState<CreditTier[]>(CREDIT_TIERS)
  const [tierId, setTierId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getCreditTiers().then((t) => {
      setTiers(t)
      setTierId((cur) => cur || (t.find((x) => x.popular) ?? t[0]).id)
    })
  }, [])

  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0]

  // Recharge autonome (depuis le profil) : signalée explicitement par ?topup=1
  // (le brouillon étant persisté, on ne peut pas se fier à son absence).
  const topup = params.get('topup') === '1'

  async function handlePay() {
    setLoading(true)
    setError('')
    try {
      const returnUrl = `${window.location.origin}${topup ? '/app/profil' : '/creer/retour'}`
      const result = await createPayment({ tierId: tier.id, draft, returnUrl, topup })
      if (!topup && result.songGenerationId) setSongGenerationId(result.songGenerationId)

      // Mode réel : GeniusPay renvoie l'URL de la page de paiement sécurisée.
      // L'utilisateur y choisit son opérateur et saisit son numéro.
      if (result.checkoutUrl) {
        if (!topup && result.songGenerationId) {
          localStorage.setItem('mamelodie:pendingSongId', result.songGenerationId)
        }
        window.location.href = result.checkoutUrl
        return
      }

      // Mode RÉEL sans URL de checkout = l'agrégateur n'a pas démarré le
      // paiement (clés GeniusPay absentes/invalides, endpoint...). On n'invente
      // JAMAIS un crédit : on affiche une erreur et on NE lance PAS la génération.
      if (isSupabaseConfigured) {
        setLoading(false)
        setError("Le paiement n'a pas pu démarrer. Vérifie ta configuration GeniusPay ou réessaie.")
        return
      }

      // Mode démo uniquement : on crédite le solde (et on en consomme un
      // seulement si une chanson est en cours), on trace l'achat, puis on enchaîne.
      addCreditsDemo(tier.credits)
      if (!topup) consumeCreditDemo()
      addDemoPayment({
        id: result.reference,
        amountFcfa: tier.priceFcfa,
        creditsPurchased: tier.credits,
        status: 'success',
        createdAt: new Date().toISOString().slice(0, 10),
      })
      setTimeout(() => {
        setLoading(false)
        navigate(topup ? '/app/profil' : '/creer/generation')
      }, 1000)
    } catch {
      setLoading(false)
      setError('Le paiement a échoué, réessaie.')
    }
  }

  return (
    <Shell
      logo
      flowLabel={topup ? 'Recharge de crédits' : 'Créer une chanson'}
      footer={
        <>
          <Button className="w-full" loading={loading} onClick={handlePay}>
            {loading ? 'Chargement…' : `Payer ${tier.priceFcfa.toLocaleString('fr-FR')} F`}
          </Button>
          <p className="text-[12px] md:text-[13px] text-clay text-center mt-2">
            Paiement sécurisé : Mobile Money (Wave, Orange, MTN) ou carte bancaire, sur la page suivante.
          </p>
        </>
      }
    >
      <BackButton onClick={() => navigate(-1)} className="mb-5" />

      <h1 className="text-[22px] md:text-[26px] mb-1">Recharge tes crédits</h1>
      <p className="text-[14px] md:text-[16px] text-ink-soft mb-6">1 crédit = 1 chanson. Plus tu prends de crédits, moins chacun coûte cher.</p>

      <div className="flex flex-col gap-2.5">
        {tiers.map((t) => {
          const active = tierId === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTierId(t.id)}
              className={`rounded-xl px-4 py-3.5 flex items-center justify-between text-left transition-colors ${
                active ? 'bg-surface border-2 border-ember-600' : 'bg-surface border border-line'
              }`}
            >
              <span>
                <span className="flex items-center gap-2">
                  <span className="text-[14px] md:text-[16px] font-semibold text-ink">
                    {t.credits} crédit{t.credits > 1 ? 's' : ''}
                  </span>
                  {t.popular && (
                    <span className="text-[11px] md:text-[12px] bg-ember-50 text-ember-700 px-2 py-0.5 rounded-md">
                      Populaire
                    </span>
                  )}
                </span>
                <span className="text-[12px] md:text-[13px] text-clay">
                  {t.credits} chanson{t.credits > 1 ? 's' : ''}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[15px] md:text-[17px] font-semibold text-ink">
                  {t.priceFcfa.toLocaleString('fr-FR')} F
                </span>
                {t.credits > 1 && (
                  <span className="block text-[11px] md:text-[12px] text-clay">
                    {Math.round(t.priceFcfa / t.credits)} F / crédit
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-[12px] md:text-[13px] text-ember-700 mt-4">{error}</p>}
    </Shell>
  )
}
