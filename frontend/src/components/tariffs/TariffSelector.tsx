import { Clock } from 'lucide-react'
import { calculatePrice, formatSum, type TariffConfig } from '../../services/pricing'
import type { RouteInfo, Tariff } from '../../types'
import { cn } from '../ui/cn'
import { TariffIcon } from './tariffIcon'

type Props = {
  tariffs: TariffConfig[]
  route: RouteInfo
  selected: Tariff
  onSelect: (id: Tariff) => void
  /** Yuqori talab koeffitsiyenti */
  surge?: number
}

export default function TariffSelector({ tariffs, route, selected, onSelect, surge = 1 }: Props) {
  return (
    <div className="scroll-thin -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Tarif">
      {tariffs.map((t) => {
        const { total } = calculatePrice(t, route.distanceKm, route.durationMin, 0, surge)
        const active = t.id === selected
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(t.id)}
            className={cn(
              'min-w-[8.75rem] flex-1 snap-start rounded-3xl border-2 p-3 text-left transition',
              active ? 'border-brand bg-brand-soft' : 'border-transparent bg-subtle hover:border-line',
            )}
          >
            <span className={cn('flex size-10 items-center justify-center rounded-2xl', active ? 'bg-brand text-on-brand' : 'bg-surface text-fg')}>
              <TariffIcon id={t.id} className="size-5" />
            </span>
            <p className="mt-2 text-sm font-semibold">{t.name}</p>
            <p className="text-lg font-extrabold tracking-tight">{formatSum(total)}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
              <Clock className="size-3" /> {t.freeWaitMin} daq bepul kutish
            </p>
          </button>
        )
      })}
    </div>
  )
}
