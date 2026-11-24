import { Car, CarFront, Package } from 'lucide-react'
import type { Tariff } from '../../types'

const ICONS: Record<Tariff, typeof Car> = { economy: Car, comfort: CarFront, delivery: Package }

export function TariffIcon({ id, className }: { id: Tariff; className?: string }) {
  const Icon = ICONS[id] ?? Car
  return <Icon className={className} />
}
