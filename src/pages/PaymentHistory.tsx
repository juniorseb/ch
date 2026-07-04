import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { getPayments, type PaymentRecord } from '../lib/api/payments'

const STATUS_LABEL: Record<PaymentRecord['status'], string> = {
  pending: 'En attente',
  success: 'Réussi',
  failed: 'Échoué',
}

const STATUS_STYLE: Record<PaymentRecord['status'], string> = {
  pending: 'bg-ember-50 text-ember-700',
  success: 'bg-leaf-100 text-leaf-900',
  failed: 'bg-line text-clay',
}

export default function PaymentHistory() {
  const navigate = useNavigate()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPayments().then((p) => {
      setPayments(p)
      setLoading(false)
    })
  }, [])

  return (
    <div className="pb-8">
      <BackButton onClick={() => navigate(-1)} className="mb-5" />

      <h1 className="text-[22px] md:text-[26px] mb-6">Historique des paiements</h1>

      {loading ? (
        <p className="text-[13px] md:text-[15px] text-clay text-center py-10">Chargement…</p>
      ) : payments.length === 0 ? (
        <p className="text-[13px] md:text-[15px] text-clay text-center py-10">Aucun paiement pour l’instant.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border border-line bg-surface rounded-xl px-4 py-3">
              <div>
                <div className="text-[14px] md:text-[16px] font-semibold text-ink">
                  {p.creditsPurchased} crédit{p.creditsPurchased > 1 ? 's' : ''}
                </div>
                <div className="text-[12px] md:text-[13px] text-clay">{p.createdAt}</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] md:text-[16px] font-semibold text-ink">
                  {p.amountFcfa.toLocaleString('fr-FR')} F
                </div>
                <span className={`inline-block text-[11px] md:text-[12px] px-2 py-0.5 rounded-md ${STATUS_STYLE[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
