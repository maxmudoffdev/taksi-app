import { Timer } from 'lucide-react'
import { useNow } from '../../hooks/useNow'
import { formatSum, minutesBetween, waitingFeeFor, type TariffConfig } from '../../services/pricing'
import { cn } from '../ui/cn'

const mmss = (min: number) => {
  const total = Math.floor(min * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Haydovchi yetib kelgandan beri o'tgan vaqt va joriy kutish haqi */
export default function WaitingTimer({ arrivedAt, tariff }: { arrivedAt: string; tariff: TariffConfig }) {
  const now = useNow(true)
  const waited = minutesBetween(arrivedAt, new Date(now))
  const freeLeft = Math.max(0, tariff.freeWaitMin - waited)
  const fee = waitingFeeFor(tariff, waited)
  const capReached = waited >= tariff.freeWaitMin + tariff.maxPaidWaitMin
  const free = freeLeft > 0

  return (
    <div className={cn('flex items-center gap-3 rounded-2xl p-3', free ? 'bg-emerald-500/10' : 'bg-amber-500/12')}>
      <span className={cn('flex size-11 items-center justify-center rounded-2xl', free ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white')}>
        <Timer className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted">Kutish vaqti</p>
        <p className="text-xs text-muted">
          {free
            ? `Bepul: yana ${mmss(freeLeft)}`
            : capReached
              ? `Chegaraga yetdi · ${formatSum(fee)}`
              : `Pullik · ${formatSum(fee)} (${formatSum(tariff.waitPerMin)}/daq)`}
        </p>
      </div>
      <span className="font-mono text-2xl font-bold tabular-nums">{mmss(waited)}</span>
    </div>
  )
}
