import { ChevronLeft, ChevronRight, Download, PhoneCall, Search, Smartphone } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { STATUS_LABEL } from '../../../../../shared/orderStatus'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import { StarsRow } from '../../../components/ui/Stars'
import { formatSum } from '../../../services/pricing'
import { useAdminStore, type OrderSearch } from '../../../store/adminStore'
import { useTariffs } from '../../../store/tariffStore'
import { formatPlate, type Order, type OrderStatus } from '../../../types'
import { downloadFile, toCsv } from '../../../utils/csv'

const PAGE_SIZE = 25
const EXPORT_MAX = 5000

const STATUS_TONE: Record<OrderStatus, 'neutral' | 'brand' | 'info' | 'violet' | 'success' | 'danger'> = {
  created: 'brand',
  accepted: 'info',
  arrived: 'violet',
  in_trip: 'info',
  completed: 'success',
  cancelled: 'danger',
}

const CANCEL_LABEL: Record<string, string> = {
  passenger: 'yo‘lovchi',
  driver: 'haydovchi',
  staff: 'dispetcher',
  no_show: 'mijoz chiqmadi',
  timeout: 'haydovchi topilmadi',
  stale: 'osilib qolgan',
}

const dateTime = new Intl.DateTimeFormat('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** "2026-11-23" (brauzer vaqti) → ISO; `nextDay` — shu kunning oxiri uchun */
const dayToIso = (day: string, nextDay = false) => {
  const d = new Date(`${day}T00:00:00`)
  if (nextDay) d.setDate(d.getDate() + 1)
  return d.toISOString()
}
const todayStr = () => new Date().toLocaleDateString('sv-SE')
const daysAgoStr = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('sv-SE')
}

type Filters = { q: string; status: string; source: 'all' | 'app' | 'phone'; from: string; to: string }

export default function OrdersHistory() {
  const searchOrders = useAdminStore((s) => s.searchOrders)
  const tariffs = useTariffs()
  const tariffName = (id: string) => tariffs.find((t) => t.id === id)?.name ?? id

  const [draft, setDraft] = useState<Filters>({ q: '', status: 'all', source: 'all', from: '', to: '' })
  const [filters, setFilters] = useState<Filters>(draft)
  const [page, setPage] = useState(0)
  // Natija qaysi so'rovga tegishli — "yuklanmoqda" shundan kelib chiqadi
  const [result, setResult] = useState<{ key: string; data?: { orders: Order[]; total: number }; error?: string } | null>(null)
  const [lastData, setLastData] = useState<{ orders: Order[]; total: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setError] = useState<string | null>(null)
  const requestKey = JSON.stringify([filters, page])
  const loading = result?.key !== requestKey
  const data = result?.data ?? lastData
  const error = exportError ?? (loading ? null : (result?.error ?? null))

  const toQuery = useCallback(
    (f: Filters): OrderSearch => ({
      q: f.q || undefined,
      status: f.status,
      source: f.source,
      from: f.from ? dayToIso(f.from) : undefined,
      to: f.to ? dayToIso(f.to, true) : undefined,
    }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    const key = JSON.stringify([filters, page])
    searchOrders({ ...toQuery(filters), page, pageSize: PAGE_SIZE })
      .then((r) => {
        if (cancelled) return
        setResult({ key, data: r })
        setLastData(r)
      })
      .catch((e: Error) => !cancelled && setResult({ key, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [filters, page, searchOrders, toQuery])

  const apply = (e?: FormEvent) => {
    e?.preventDefault()
    setError(null)
    setPage(0)
    setFilters(draft)
  }
  const quick = (from: string, to: string) => {
    const next = { ...draft, from, to }
    setDraft(next)
    setPage(0)
    setFilters(next)
  }

  const exportCsv = async () => {
    setExporting(true)
    setError(null)
    try {
      const { orders, total } = await searchOrders({ ...toQuery(filters), page: 0, pageSize: EXPORT_MAX })
      const rows = [
        ['Sana', 'Holat', 'Bekor sababi', 'Manba', 'Tarif', 'Mijoz', 'Mijoz telefoni', 'Haydovchi', 'Haydovchi telefoni', 'Davlat raqami', 'Qayerdan', 'Mo‘ljal', 'Qayerga', 'Km', 'Narx', 'Kutish', 'Jami', 'Koeff.', 'Baho', 'Izoh'],
        ...orders.map((o) => [
          dateTime.format(new Date(o.createdAt)),
          STATUS_LABEL[o.status],
          o.cancelReason ? CANCEL_LABEL[o.cancelReason] : '',
          o.source === 'phone' ? 'Telefon' : 'Ilova',
          tariffName(o.tariff),
          o.passengerName,
          o.passengerPhone,
          o.driverName,
          o.driverPhone,
          o.driverCar ? formatPlate(o.driverCar.plate) : '',
          o.pickupAddress,
          o.pickupNote,
          o.dropoffAddress,
          o.distanceKm,
          o.price,
          o.waitingFee,
          o.price + o.waitingFee,
          o.surge > 1 ? o.surge : '',
          o.rating,
          o.ratingComment,
        ]),
      ]
      downloadFile(`buyurtmalar_${todayStr()}.csv`, toCsv(rows))
      if (total > orders.length) setError(`Faqat birinchi ${orders.length} tasi yuklandi (jami ${total}). Sana bo‘yicha toraytiring.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const completed = data?.orders.filter((o) => o.status === 'completed') ?? []
  const select = 'h-11 rounded-2xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand'

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
          <label className="flex h-11 min-w-[16rem] flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3 text-sm focus-within:border-brand">
            <Search className="size-4 text-muted" />
            <input
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              placeholder="Telefon, ism, manzil, davlat raqami…"
              className="w-full bg-transparent outline-none placeholder:text-muted"
            />
          </label>
          <select aria-label="Holat" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={select}>
            <option value="all">Barcha holatlar</option>
            <option value="active">Faol</option>
            <option value="completed">{STATUS_LABEL.completed}</option>
            <option value="cancelled">{STATUS_LABEL.cancelled}</option>
          </select>
          <select aria-label="Manba" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as Filters['source'] })} className={select}>
            <option value="all">Ilova + telefon</option>
            <option value="app">Ilova</option>
            <option value="phone">Telefon</option>
          </select>
          <label className="text-xs text-muted">
            Dan
            <input type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={`${select} mt-1 block`} />
          </label>
          <label className="text-xs text-muted">
            Gacha
            <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={`${select} mt-1 block`} />
          </label>
          <Button type="submit" variant="dark">
            Qidirish
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button onClick={() => quick(todayStr(), todayStr())} className="rounded-full bg-subtle px-3 py-1 font-medium hover:bg-line">
            Bugun
          </button>
          <button onClick={() => quick(daysAgoStr(6), todayStr())} className="rounded-full bg-subtle px-3 py-1 font-medium hover:bg-line">
            7 kun
          </button>
          <button onClick={() => quick('', '')} className="rounded-full bg-subtle px-3 py-1 font-medium hover:bg-line">
            Hammasi
          </button>
          <Button size="sm" variant="outline" className="ml-auto" icon={<Download className="size-4" />} loading={exporting} disabled={!total} onClick={exportCsv}>
            Excel’ga yuklash
          </Button>
        </div>
      </Card>

      {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm">
          <span className="font-semibold">
            {loading ? 'Yuklanmoqda…' : `${total} ta buyurtma`}
          </span>
          {!!completed.length && (
            <span className="text-muted">
              Sahifada tushum: <b className="text-fg">{formatSum(completed.reduce((s, o) => s + o.price + o.waitingFee, 0))}</b>
            </span>
          )}
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-subtle text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Sana</th>
                <th className="px-3 py-2.5 font-semibold">Mijoz</th>
                <th className="px-3 py-2.5 font-semibold">Haydovchi</th>
                <th className="px-3 py-2.5 font-semibold">Yo‘nalish</th>
                <th className="px-3 py-2.5 font-semibold">Holat</th>
                <th className="px-3 py-2.5 text-right font-semibold">Narx</th>
                <th className="px-4 py-2.5 font-semibold">Baho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data?.orders.map((o) => (
                <tr key={o.id} className="align-top hover:bg-subtle/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {o.source === 'phone' ? <PhoneCall className="size-3.5 text-sky-600" /> : <Smartphone className="size-3.5 text-muted" />}
                      {dateTime.format(new Date(o.createdAt))}
                    </span>
                    <span className="text-xs text-muted">{tariffName(o.tariff)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="block max-w-[10rem] truncate font-medium">{o.passengerName ?? '—'}</span>
                    <span className="text-xs text-muted tabular-nums">{o.passengerPhone}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="block max-w-[10rem] truncate font-medium">{o.driverName ?? '—'}</span>
                    <span className="text-xs text-muted">{o.driverCar ? formatPlate(o.driverCar.plate) : o.driverPhone}</span>
                  </td>
                  <td className="max-w-[16rem] px-3 py-3">
                    <span className="block truncate">{o.pickupAddress ?? o.pickupNote ?? '—'}</span>
                    <span className="block truncate text-xs text-muted">→ {o.dropoffAddress ?? (o.dropoff ? 'Xaritadagi nuqta' : 'noma’lum')}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    {o.cancelReason && <span className="mt-1 block text-xs text-muted">{CANCEL_LABEL[o.cancelReason]}</span>}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <span className="font-semibold">{formatSum(o.price + o.waitingFee)}</span>
                    {o.surge > 1 && <span className="block text-xs text-amber-600">×{o.surge}</span>}
                  </td>
                  <td className="px-4 py-3">{o.rating ? <StarsRow value={o.rating} /> : <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !data?.orders.length && <p className="py-12 text-center text-muted">Buyurtma topilmadi</p>}
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3 text-sm">
            <span className="mr-2 text-muted">
              {page + 1} / {pages}
            </span>
            <Button size="sm" variant="outline" icon={<ChevronLeft className="size-4" />} disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
              Oldingi
            </Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)}>
              Keyingi <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
