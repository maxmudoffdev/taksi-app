import { ChevronRight, Gauge, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatSum } from '../../services/pricing'
import type { Standing } from '../../store/walletStore'
import { cn } from '../ui/cn'
import { ZONE_STYLE } from './zoneStyle'

/** Balans va ball — bosilsa batafsil sahifa */
export default function StandingStrip({ standing }: { standing: Standing }) {
  const zone = ZONE_STYLE[standing.zone]
  const negative = standing.balance < 0
  return (
    <Link to="/wallet" className="mb-4 block rounded-3xl border border-line transition hover:bg-subtle">
      <div className="flex items-center gap-3 p-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-2xl', negative ? 'bg-red-500/12 text-red-600' : 'bg-subtle text-muted')}>
            <Wallet className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted">Balans</p>
            <p className={cn('truncate font-extrabold tracking-tight tabular-nums', negative && 'text-red-600 dark:text-red-400')}>{formatSum(standing.balance)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-subtle text-muted">
            <Gauge className="size-[18px]" />
          </span>
          <div>
            <p className="text-xs text-muted">Ball</p>
            <p className={cn('flex items-center gap-1.5 font-extrabold tabular-nums', zone.text)}>
              <span className={cn('size-2 rounded-full', zone.dot)} />
              {standing.score}
            </p>
          </div>
        </div>
        <ChevronRight className="size-5 text-muted" />
      </div>
      {standing.blockMessage && (
        <p className="rounded-b-3xl border-t border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">
          ⛔ {standing.blockMessage}
        </p>
      )}
    </Link>
  )
}
