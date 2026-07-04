import { useEffect, useState } from 'react'
import Toggle from '../../components/Toggle'
import {
  isOtpEnabled,
  setOtpEnabled,
  getProviderSettings,
  setProviderSetting,
  getCreditTiers,
  setCreditTiers,
  isGeniuspaySandbox,
  setGeniuspaySandbox,
  getSecretsStatus,
  setSecret,
  type SecretsStatus,
  type ProviderSettings,
} from '../../lib/api/admin'
import type { CreditTier } from '../../lib/types'

// État par défaut (aucun secret configuré) : permet d'afficher TOUJOURS les
// champs, même si le statut n'a pas pu être chargé (fonctions non déployées…).
const EMPTY_SECRETS: SecretsStatus = {
  geniuspay_pk_sandbox: false,
  geniuspay_sk_sandbox: false,
  geniuspay_whsec_sandbox: false,
  geniuspay_pk_live: false,
  geniuspay_sk_live: false,
  geniuspay_whsec_live: false,
  openrouter_api_key: false,
  groq_api_key: false,
  apipass_api_key: false,
  resend_api_key: false,
}

function SecretRow({
  label,
  keyName,
  configured,
  onSave,
}: {
  label: string
  keyName: keyof SecretsStatus
  configured: boolean
  onSave: (key: keyof SecretsStatus, value: string) => Promise<void>
}) {
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    if (saving || !val.trim()) return
    setSaving(true)
    try {
      await onSave(keyName, val.trim())
      setVal('')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] md:text-[14px] text-ink">{label}</span>
        <span className={`text-[11px] md:text-[12px] ${configured ? 'text-leaf-600' : 'text-clay'}`}>
          {configured ? '✓ configuré' : 'non configuré'}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={configured ? 'Laisser vide pour conserver' : 'Coller la clé'}
          className="flex-1 h-10 rounded-lg border border-line px-3 text-[14px] bg-surface-2 outline-none focus:border-ember-600"
        />
        <button
          onClick={save}
          disabled={saving || !val.trim()}
          className="h-10 px-3 rounded-lg bg-ember-600 text-cream text-[13px] font-semibold disabled:opacity-40"
        >
          {saving ? '…' : 'OK'}
        </button>
      </div>
    </div>
  )
}

function SettingRow({
  title,
  desc,
  on,
  onChange,
  disabled,
}: {
  title: string
  desc: string
  on: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div>
        <div className="text-[14px] md:text-[16px] font-semibold text-ink">{title}</div>
        <div className="text-[12px] md:text-[13px] text-clay">{desc}</div>
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} />
    </div>
  )
}

export default function AdminSettings() {
  const [otp, setOtp] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [providers, setProviders] = useState<ProviderSettings | null>(null)
  const [savingKey, setSavingKey] = useState<string>('')
  const [sandbox, setSandbox] = useState<boolean | null>(null)
  const [savingSandbox, setSavingSandbox] = useState(false)
  const [tiers, setTiers] = useState<CreditTier[] | null>(null)
  const [savingTiers, setSavingTiers] = useState(false)
  const [tiersSaved, setTiersSaved] = useState(false)
  const [secrets, setSecrets] = useState<SecretsStatus>(EMPTY_SECRETS)

  useEffect(() => {
    isOtpEnabled().then(setOtp)
    getProviderSettings().then(setProviders).catch(() => setProviders(null))
    getCreditTiers().then(setTiers).catch(() => setTiers(null))
    isGeniuspaySandbox().then(setSandbox).catch(() => setSandbox(null))
    getSecretsStatus().then(setSecrets).catch(() => setSecrets(EMPTY_SECRETS))
  }, [])

  async function toggleOtp() {
    if (otp === null || saving) return
    setSaving(true)
    const next = !otp
    try {
      await setOtpEnabled(next)
      setOtp(next)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSecret(key: keyof SecretsStatus, value: string) {
    await setSecret(key, value)
    setSecrets(await getSecretsStatus())
  }

  async function toggleSandbox() {
    if (sandbox === null || savingSandbox) return
    const next = !sandbox
    setSavingSandbox(true)
    try {
      await setGeniuspaySandbox(next)
      setSandbox(next)
    } finally {
      setSavingSandbox(false)
    }
  }

  function editTier(id: string, field: 'credits' | 'priceFcfa', value: number) {
    setTiers((prev) => prev && prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
    setTiersSaved(false)
  }

  async function saveTiers() {
    if (!tiers || savingTiers) return
    setSavingTiers(true)
    try {
      await setCreditTiers(tiers)
      setTiersSaved(true)
    } finally {
      setSavingTiers(false)
    }
  }

  async function toggleProvider(field: keyof ProviderSettings) {
    if (!providers || savingKey) return
    const next = !providers[field]
    setSavingKey(field)
    try {
      await setProviderSetting(field, next)
      setProviders({ ...providers, [field]: next })
    } finally {
      setSavingKey('')
    }
  }

  return (
    <div>
      <h1 className="text-[22px] md:text-[26px] mb-1">Réglages</h1>
      <p className="text-[13px] md:text-[15px] text-ink-soft mb-6">Configuration de la plateforme : accès, fournisseurs, clés et paiement.</p>

      {/* Accès */}
      <h2 className="text-[17px] md:text-[19px] mb-3">Accès</h2>
      <div className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between mb-2">
        <div className="pr-4">
          <div className="text-[14px] md:text-[16px] font-semibold text-ink">Vérification par code (OTP)</div>
          <div className="text-[12px] md:text-[13px] text-clay">
            Désactive-la pour laisser les nouveaux inscrits entrer sans vérifier leur email.
          </div>
        </div>
        <Toggle on={!!otp} onChange={toggleOtp} disabled={otp === null || saving} />
      </div>
      <p className="text-[12px] md:text-[13px] text-clay mb-8">
        {otp === null ? '' : otp ? 'OTP activé : les inscrits vérifient leur email.' : 'OTP désactivé : inscription directe, sans vérification.'}
      </p>

      {/* Fournisseurs IA & musique */}
      <h2 className="text-[17px] md:text-[19px] mb-1">Fournisseurs</h2>
      <p className="text-[12px] md:text-[13px] text-clay mb-3">
        Paroles : gpt-4o-mini (OpenRouter) en principal, Groq en secours automatique. Musique : ApiPass (Suno).
      </p>
      <div className="bg-surface border border-line rounded-xl divide-y divide-line">
        <div className="px-4 pt-3 pb-1 text-[11px] md:text-[12px] uppercase tracking-wide text-clay">Paroles (IA)</div>
        <SettingRow
          title="gpt-4o-mini (OpenRouter)"
          desc="Fournisseur principal des paroles."
          on={!!providers?.lyricsOpenaiEnabled}
          onChange={() => toggleProvider('lyricsOpenaiEnabled')}
          disabled={!providers || savingKey === 'lyricsOpenaiEnabled'}
        />
        <SettingRow
          title="Groq — Llama 3.3 (secours)"
          desc="Utilisé si OpenAI est désactivé ou indisponible."
          on={!!providers?.lyricsGroqEnabled}
          onChange={() => toggleProvider('lyricsGroqEnabled')}
          disabled={!providers || savingKey === 'lyricsGroqEnabled'}
        />
        <div className="px-4 pt-3 pb-1 text-[11px] md:text-[12px] uppercase tracking-wide text-clay">Musique</div>
        <SettingRow
          title="ApiPass (Suno)"
          desc="Génération audio des deux versions."
          on={!!providers?.musicApipassEnabled}
          onChange={() => toggleProvider('musicApipassEnabled')}
          disabled={!providers || savingKey === 'musicApipassEnabled'}
        />
      </div>
      {providers && !providers.lyricsOpenaiEnabled && !providers.lyricsGroqEnabled && (
        <p className="text-[12px] md:text-[13px] text-ember-700 mt-2">
          ⚠️ Aucun fournisseur de paroles actif : la génération échouera.
        </p>
      )}

      {/* Clés des fournisseurs IA & services (stockage sécurisé) */}
      <div className="bg-surface border border-line rounded-xl p-4 mt-3">
        <div className="text-[14px] md:text-[16px] font-semibold text-ink mb-1">Clés IA & services</div>
        <div className="text-[12px] md:text-[13px] text-clay mb-4">
          Stockées de façon sécurisée. Laisser vide = conserver la clé actuelle (ou le repli du serveur).
        </div>
        <div className="flex flex-col gap-3">
          <SecretRow label="OpenRouter (paroles — gpt-4o-mini)" keyName="openrouter_api_key" configured={secrets.openrouter_api_key} onSave={handleSaveSecret} />
          <SecretRow label="Groq (paroles — secours)" keyName="groq_api_key" configured={secrets.groq_api_key} onSave={handleSaveSecret} />
          <SecretRow label="ApiPass (musique — Suno)" keyName="apipass_api_key" configured={secrets.apipass_api_key} onSave={handleSaveSecret} />
          <SecretRow label="Resend (emails — OTP)" keyName="resend_api_key" configured={secrets.resend_api_key} onSave={handleSaveSecret} />
        </div>
      </div>

      {/* Paiement : mode GeniusPay + tarifs */}
      <h2 className="text-[17px] md:text-[19px] mt-8 mb-3">Paiement</h2>
      <div className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between mb-2">
        <div className="pr-4">
          <div className="text-[14px] md:text-[16px] font-semibold text-ink">Mode test (sandbox GeniusPay)</div>
          <div className="text-[12px] md:text-[13px] text-clay">
            Activé : paiements de test (sandbox). Désactivé : paiements réels (production).
          </div>
        </div>
        <Toggle on={!!sandbox} onChange={toggleSandbox} disabled={sandbox === null || savingSandbox} />
      </div>
      <p className="text-[12px] md:text-[13px] text-clay mb-6">
        {sandbox === null ? '' : sandbox ? '🧪 Sandbox : aucun argent réel n’est débité.' : '🔴 Production : les paiements sont réels.'}
      </p>

      {/* Clés GeniusPay (stockées de façon sécurisée, jamais lues côté client) */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-6">
        <div className="text-[14px] md:text-[16px] font-semibold text-ink mb-1">Clés GeniusPay</div>
        <div className="text-[12px] md:text-[13px] text-clay mb-4">
          Depuis GeniusPay : <span className="text-ink-soft">Paramètres → API</span>. Stockées de façon sécurisée (jamais visibles ni côté client, ni ici après enregistrement).
        </div>
        <div className="flex flex-col gap-5">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-clay mb-2.5">Sandbox (test)</div>
            <div className="flex flex-col gap-3">
              <SecretRow label="Clé publique (pk_sandbox_…)" keyName="geniuspay_pk_sandbox" configured={secrets.geniuspay_pk_sandbox} onSave={handleSaveSecret} />
              <SecretRow label="Clé secrète (sk_sandbox_…)" keyName="geniuspay_sk_sandbox" configured={secrets.geniuspay_sk_sandbox} onSave={handleSaveSecret} />
              <SecretRow label="Secret webhook (whsec_sandbox_…)" keyName="geniuspay_whsec_sandbox" configured={secrets.geniuspay_whsec_sandbox} onSave={handleSaveSecret} />
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-clay mb-2.5">Production (live)</div>
            <div className="flex flex-col gap-3">
              <SecretRow label="Clé publique (pk_live_…)" keyName="geniuspay_pk_live" configured={secrets.geniuspay_pk_live} onSave={handleSaveSecret} />
              <SecretRow label="Clé secrète (sk_live_…)" keyName="geniuspay_sk_live" configured={secrets.geniuspay_sk_live} onSave={handleSaveSecret} />
              <SecretRow label="Secret webhook (whsec_live_…)" keyName="geniuspay_whsec_live" configured={secrets.geniuspay_whsec_live} onSave={handleSaveSecret} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="text-[14px] md:text-[16px] font-semibold text-ink mb-1">Tarifs des crédits</div>
        <div className="text-[12px] md:text-[13px] text-clay mb-4">1 crédit = 1 chanson. Modifie le nombre de crédits et le prix (FCFA) de chaque offre.</div>
        <div className="flex flex-col gap-2.5">
          {(tiers ?? []).map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 flex-1">
                <input
                  type="number"
                  min={1}
                  value={t.credits}
                  onChange={(e) => editTier(t.id, 'credits', Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                  className="w-16 h-10 rounded-lg border border-line px-2 text-[15px] bg-surface-2 outline-none focus:border-ember-600 text-center"
                />
                <span className="text-[13px] md:text-[15px] text-ink-soft">crédit{t.credits > 1 ? 's' : ''}</span>
              </label>
              <span className="text-clay">→</span>
              <label className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={t.priceFcfa}
                  onChange={(e) => editTier(t.id, 'priceFcfa', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="w-24 h-10 rounded-lg border border-line px-2 text-[15px] bg-surface-2 outline-none focus:border-ember-600 text-right"
                />
                <span className="text-[13px] md:text-[15px] text-ink-soft">FCFA</span>
              </label>
              {t.popular && (
                <span className="text-[11px] bg-ember-50 text-ember-700 px-2 py-0.5 rounded-md">Populaire</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={saveTiers}
            disabled={!tiers || savingTiers}
            className="h-10 px-4 rounded-lg bg-ember-600 text-cream text-[13px] md:text-[15px] font-semibold disabled:opacity-50"
          >
            {savingTiers ? 'Enregistrement…' : 'Enregistrer les tarifs'}
          </button>
          {tiersSaved && <span className="text-[12px] md:text-[13px] text-leaf-600">✓ Tarifs enregistrés</span>}
        </div>
      </div>
    </div>
  )
}
