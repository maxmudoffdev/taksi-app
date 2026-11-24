import { Ban, Check, RotateCcw, Search, ShieldOff, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import Avatar from '../../../components/ui/Avatar'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import { cn } from '../../../components/ui/cn'
import Plate from '../../../components/ui/Plate'
import { ZONE_STYLE } from '../../../components/driver/zoneStyle'
import { RatingBadge } from '../../../components/ui/Stars'
import { formatSum } from '../../../services/pricing'
import { scoreZone } from '../../../services/wallet'
import { useAdminStore, type DriverRow } from '../../../store/adminStore'
import DriverWalletDialog from './DriverWalletDialog'

type Filter = 'all' | 'pending' | 'blocked' | 'debt'

function status(d: DriverRow) {
  if (d.isBlocked) return <Badge tone="danger">Bloklangan</Badge>
  if (!d.isApproved) return <Badge tone="warning">Tasdiq kutmoqda</Badge>
  if (d.isOnline) return <Badge tone="success">Onlayn</Badge>
  return <Badge>Oflayn</Badge>
}

export default function DriversTable() {
  const { driverRows, loadDrivers, approveDriver, blockUser } = useAdminStore()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [walletOf, setWalletOf] = useState<DriverRow | null>(null)
  const hasWallet = driverRows.some((d) => d.balance != null)

  useEffect(() => {
    loadDrivers().catch((e: Error) => setError(e.message))
  }, [loadDrivers])

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  const name = (d: DriverRow) => d.fullName ?? 'Haydovchi'
  const block = (d: DriverRow) =>
    confirm(`${name(d)}ni bloklaysizmi? U tizimga kira olmaydi va buyurtma ololmaydi.`) && run(d.id, () => blockUser(d.id, true))

  const counts = {
    all: driverRows.length,
    pending: driverRows.filter((d) => !d.isApproved && !d.isBlocked).length,
    blocked: driverRows.filter((d) => d.isBlocked).length,
    debt: driverRows.filter((d) => (d.balance ?? 0) < 0).length,
  }
  const q = query.trim().toLowerCase()
  const rows = driverRows
    .filter((d) =>
      filter === 'pending' ? !d.isApproved && !d.isBlocked : filter === 'blocked' ? d.isBlocked : filter === 'debt' ? (d.balance ?? 0) < 0 : true,
    )
    .filter((d) => {
      if (!q) return true
      const hay = [d.fullName, d.phone, d.car?.plate, d.car?.model].join(' ').toLowerCase()
      // Davlat raqami bo'shliqsiz saqlanadi: "01 a 123" ham topilsin
      return hay.includes(q) || hay.includes(q.replace(/\s/g, ''))
    })

  const tabs: [Filter, string][] = [
    ['all', 'Hammasi'],
    ['pending', 'Tasdiq kutayotgan'],
    ['blocked', 'Bloklangan'],
    ...(hasWallet ? ([['debt', 'Balansi manfiy']] as [Filter, string][]) : []),
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn('rounded-full px-3 py-1.5 text-sm font-semibold transition', filter === key ? 'bg-ink text-on-ink' : 'bg-subtle text-muted hover:text-fg')}
          >
            {label} · {counts[key]}
          </button>
        ))}
        <label className="ml-auto flex h-9 min-w-[14rem] items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm max-sm:w-full">
          <Search className="size-4 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ism, telefon yoki raqam" className="w-full bg-transparent outline-none placeholder:text-muted" />
        </label>
      </div>
      {error && <p className="mb-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}
      {!rows.length && <p className="py-10 text-center text-muted">Haydovchilar topilmadi</p>}

      <ul className="divide-y divide-line">
        {rows.map((d) => (
          <li key={d.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5', d.isBlocked && 'opacity-70')}>
            <div className="flex min-w-[14rem] flex-1 items-center gap-3">
              <Avatar name={d.fullName} />
              <div className="min-w-0">
                <p className="flex items-center gap-2">
                  <span className="truncate font-semibold">{d.fullName ?? 'Ismsiz'}</span>
                  {status(d)}
                </p>
                <p className="truncate text-xs text-muted">
                  {d.phone ?? 'telefon yo‘q'} · {new Date(d.createdAt).toLocaleDateString('uz-UZ')}
                </p>
              </div>
            </div>

            <div className="flex min-w-[12rem] items-center gap-3">
              {d.car ? (
                <>
                  <Plate plate={d.car.plate} />
                  <span className="min-w-0 text-xs">
                    <span className="block truncate font-medium">{d.car.model}</span>
                    <span className="text-muted">{d.car.color}</span>
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted">Mashina kiritilmagan</span>
              )}
            </div>

            <div className="w-24">
              <RatingBadge rating={d.rating} count={d.ratingCount || undefined} />
            </div>

            {d.balance != null && d.score != null && (
              <button
                onClick={() => setWalletOf(d)}
                title="Balans va ball"
                className="flex w-40 items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-subtle"
              >
                <Wallet className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 text-xs">
                  <span className={cn('block truncate font-semibold tabular-nums', d.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-fg')}>{formatSum(d.balance)}</span>
                  <span className={cn('flex items-center gap-1 font-medium', ZONE_STYLE[scoreZone(d.score)].text)}>
                    <span className={cn('size-1.5 rounded-full', ZONE_STYLE[scoreZone(d.score)].dot)} />
                    {d.score} ball{d.redUntil ? ' · pauza' : ''}
                  </span>
                </span>
              </button>
            )}

            <div className="flex gap-2">
              {d.isBlocked ? (
                <Button size="sm" variant="outline" icon={<RotateCcw className="size-4" />} loading={busyId === d.id} onClick={() => run(d.id, () => blockUser(d.id, false))}>
                  Blokdan chiqarish
                </Button>
              ) : (
                <>
                  {d.isApproved ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<ShieldOff className="size-4" />}
                      disabled={busyId === d.id}
                      title="Qayta tekshiruvga qaytarish"
                      onClick={() => confirm(`${name(d)}ning tasdig‘ini bekor qilasizmi?`) && run(d.id, () => approveDriver(d.id, false))}
                    >
                      Tasdiqni olish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="success"
                      icon={<Check className="size-4" />}
                      loading={busyId === d.id}
                      disabled={!d.car}
                      title={d.car ? undefined : 'Avval haydovchi mashina ma’lumotini kiritsin'}
                      onClick={() => run(d.id, () => approveDriver(d.id, true))}
                    >
                      Tasdiqlash
                    </Button>
                  )}
                  <Button size="sm" variant="danger" icon={<Ban className="size-4" />} disabled={busyId === d.id} onClick={() => block(d)}>
                    Bloklash
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {walletOf && <DriverWalletDialog driver={walletOf} onClose={() => setWalletOf(null)} />}
    </div>
  )
}
