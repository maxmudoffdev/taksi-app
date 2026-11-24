import { useState, type FormEvent } from 'react'
import {
  calculatePrice,
  formatSum,
  TARIFF_NUMBER_FIELDS,
  type TariffConfig,
  type TariffNumberField,
} from '../../../services/pricing'
import { useAdminStore } from '../../../store/adminStore'
import { useTariffs } from '../../../store/tariffStore'
import CommissionSettings from './CommissionSettings'
import SurgeSettings from './SurgeSettings'

const FIELDS = Object.entries(TARIFF_NUMBER_FIELDS) as [TariffNumberField, (typeof TARIFF_NUMBER_FIELDS)[TariffNumberField]][]

function TariffForm({ tariff }: { tariff: TariffConfig }) {
  const updateTariff = useAdminStore((s) => s.updateTariff)
  const [draft, setDraft] = useState<Record<TariffNumberField, string>>(
    () => Object.fromEntries(FIELDS.map(([k]) => [k, String(tariff[k])])) as Record<TariffNumberField, string>,
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const parsed = Object.fromEntries(FIELDS.map(([k]) => [k, Number(draft[k])])) as Record<TariffNumberField, number>
  const changed = FIELDS.filter(([k]) => parsed[k] !== tariff[k]).map(([k]) => k)
  const valid = FIELDS.every(([k, rule]) => Number.isInteger(parsed[k]) && parsed[k] >= 0 && parsed[k] <= rule.max)
  const preview = valid ? calculatePrice({ ...tariff, ...parsed }, 5, 12).total : null

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!changed.length || !valid) return
    setSaving(true)
    setMessage(null)
    try {
      await updateTariff(tariff.id, Object.fromEntries(changed.map((k) => [k, parsed[k]])))
      setMessage({ ok: true, text: 'Saqlandi — yo‘lovchilarda narxlar yangilandi' })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="rounded-3xl border border-line/70 bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold">
          {tariff.icon} {tariff.name}
        </p>
        {preview !== null && <p className="text-sm text-muted">5 km / 12 daq ≈ <b className="text-fg">{formatSum(preview)}</b></p>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FIELDS.map(([key, rule]) => (
          <label key={key} className="text-sm">
            <span className="text-muted">{rule.label}</span>
            <div className="mt-1 flex items-center rounded-xl border border-line focus-within:ring-2 focus-within:ring-brand/30">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={rule.max}
                step={1}
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className={`w-full min-w-0 rounded-xl px-2 py-1.5 outline-none ${changed.includes(key) ? 'bg-brand-soft font-semibold' : ''}`}
              />
              <span className="pr-2 text-xs text-muted">{rule.unit}</span>
            </div>
          </label>
        ))}
      </div>
      {!valid && <p className="mt-2 text-sm text-red-600">Qiymatlar 0 yoki undan katta butun son bo‘lishi kerak</p>}
      {message && <p className={`mt-2 text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
      <button
        disabled={!changed.length || !valid || saving}
        className="mt-3 rounded-xl bg-brand text-on-brand px-4 py-2 font-semibold hover:bg-brand-strong disabled:opacity-40"
      >
        {saving ? 'Saqlanmoqda…' : changed.length ? `Saqlash (${changed.length})` : 'O‘zgarish yo‘q'}
      </button>
    </form>
  )
}

export default function TariffEditor() {
  const tariffs = useTariffs()
  return (
    <div className="space-y-3">
      <SurgeSettings />
      <CommissionSettings />
      <p className="pt-2 text-sm text-muted">O‘zgarishlar darhol barcha yo‘lovchilar ekranida va yangi buyurtmalarda qo‘llanadi.</p>
      {tariffs.map((t) => (
        // Serverdan yangi qiymat kelganda forma qayta to'ldirilsin
        <TariffForm key={`${t.id}:${FIELDS.map(([k]) => t[k]).join(',')}`} tariff={t} />
      ))}
    </div>
  )
}
