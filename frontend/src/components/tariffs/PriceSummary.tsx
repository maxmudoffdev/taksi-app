import { ChevronDown } from 'lucide-react'
import { calculatePrice, formatSum, formatSurge, type TariffConfig } from '../../services/pricing'
import type { RouteInfo } from '../../types'

type Props = { tariff: TariffConfig; route: RouteInfo; waitingMin?: number; surge?: number }

/** Narx qanday hisoblangani (yig'iladigan) */
export default function PriceSummary({ tariff, route, waitingMin = 0, surge = 1 }: Props) {
  const p = calculatePrice(tariff, route.distanceKm, route.durationMin, waitingMin, surge)
  const rows: [string, number][] = [
    ['Boshlang‘ich narx', p.base],
    [`Masofa · ${route.distanceKm.toFixed(1)} km × ${formatSum(tariff.perKm)}`, p.distance],
    [`Vaqt · ${route.durationMin} daq × ${formatSum(tariff.perMin)}`, p.time],
  ]
  if (p.minFareTopUp > 0) rows.push(['Eng kam narxgacha', p.minFareTopUp])
  if (p.surgeAmount > 0) rows.push([`Yuqori talab · ${formatSurge(surge)}`, p.surgeAmount])
  if (p.waiting > 0) rows.push([`Kutish · ${p.paidWaitMin} daq × ${formatSum(tariff.waitPerMin)}`, p.waiting])

  return (
    <details className="group mt-3 rounded-2xl text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-1 py-1.5 text-muted hover:text-fg">
        <span>Narx tafsiloti</span>
        <ChevronDown className="size-4 transition group-open:rotate-180" />
      </summary>
      <dl className="mt-1 space-y-1.5 rounded-2xl bg-subtle p-3 text-muted">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt>{label}</dt>
            <dd className="whitespace-nowrap font-medium text-fg">{formatSum(value)}</dd>
          </div>
        ))}
        <p className="border-t border-line pt-2 text-xs">
          Haydovchi yetib kelgach {tariff.freeWaitMin} daqiqa kutish bepul, keyin har daqiqasi {formatSum(tariff.waitPerMin)} (ko‘pi bilan{' '}
          {tariff.maxPaidWaitMin} daq). Narx 500 so‘mga yaxlitlanadi.
        </p>
      </dl>
    </details>
  )
}
