import { CheckCircle2, Hourglass, Radio, Car, Wallet } from 'lucide-react'
import { formatSum } from '../../../services/pricing'
import type { AdminStats } from '../../../store/adminStore'
import { cn } from '../../../components/ui/cn'

export default function StatsBar({ stats, onlineDrivers }: { stats: AdminStats | null; onlineDrivers: number }) {
  const items = [
    { label: 'Onlayn haydovchi', value: String(onlineDrivers), icon: Radio, tone: 'bg-emerald-500/12 text-emerald-600' },
    { label: 'Faol buyurtma', value: String(stats?.activeOrders ?? '—'), icon: Car, tone: 'bg-sky-500/12 text-sky-600' },
    { label: 'Qidirilmoqda', value: String(stats?.searchingOrders ?? '—'), icon: Hourglass, tone: 'bg-amber-500/15 text-amber-600' },
    { label: 'Bugun yakunlangan', value: String(stats?.completedToday ?? '—'), icon: CheckCircle2, tone: 'bg-violet-500/12 text-violet-600' },
    { label: 'Bugungi tushum', value: stats ? formatSum(stats.revenueToday) : '—', icon: Wallet, tone: 'bg-brand-soft text-amber-700 dark:text-brand' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="rounded-3xl border border-line/70 bg-surface p-4 shadow-card">
          <span className={cn('flex size-10 items-center justify-center rounded-2xl', tone)}>
            <Icon className="size-5" />
          </span>
          <p className="mt-3 text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
          <p className="text-xs text-muted">{label}</p>
        </div>
      ))}
    </div>
  )
}
