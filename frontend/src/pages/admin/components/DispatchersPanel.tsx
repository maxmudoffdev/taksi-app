import { useEffect, useState, type FormEvent } from 'react'
import { request } from '../../../services/socket'

type Staff = { id: string; email: string | null; fullName: string | null; phone: string | null }

/** Admin: dispetcherlarni tayinlash va olib tashlash */
export default function DispatchersPanel() {
  const [list, setList] = useState<Staff[]>([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    request<Staff[]>('admin:dispatchers', null)
      .then(setList)
      .catch((e: Error) => setMessage({ ok: false, text: e.message }))
  }, [])

  const setRole = async (targetEmail: string, enabled: boolean) => {
    setBusy(true)
    setMessage(null)
    try {
      setList(await request<Staff[]>('admin:setDispatcher', { email: targetEmail, enabled }))
      setMessage({ ok: true, text: enabled ? `${targetEmail} endi dispetcher` : `${targetEmail} oddiy yo‘lovchiga qaytarildi` })
      if (enabled) setEmail('')
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (email.trim()) setRole(email.trim(), true)
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted">
        <p>Dispetcher qisqa raqamga qo‘ng‘iroq qilgan mijozlar uchun buyurtma yaratadi.</p>
        <p className="mt-1">
          Avval xodim saytda <b>yo‘lovchi</b> sifatida ro‘yxatdan o‘tadi, keyin uning emailini shu yerga kiriting.
        </p>
      </div>

      <form onSubmit={add} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="xodim@email.uz"
          className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button disabled={busy} className="shrink-0 rounded-xl bg-brand text-on-brand px-4 py-2 font-semibold hover:bg-brand-strong disabled:opacity-50">
          + Dispetcher qilish
        </button>
      </form>

      {message && <p className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}

      {!list.length ? (
        <p className="py-4 text-center text-muted">Hali dispetcher yo‘q</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">☎️ {s.fullName ?? 'Ismsiz'}</p>
                <p className="truncate text-xs text-muted">
                  {s.email} {s.phone && `· ${s.phone}`}
                </p>
              </div>
              {s.email && (
                <button
                  onClick={() => confirm(`${s.email} dispetcherlikdan olinsinmi?`) && setRole(s.email!, false)}
                  disabled={busy}
                  className="shrink-0 rounded-xl border border-line px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Olib tashlash
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
