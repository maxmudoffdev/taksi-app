import { CarFront } from 'lucide-react'
import type { CarInfo } from '../../types'
import Plate from '../ui/Plate'

/** Mashina: rusum, rang va davlat raqami — yo'lovchi qaysi mashinaga o'tirishini bilsin */
export default function CarDetails({ car }: { car: CarInfo }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <CarFront className="size-5 shrink-0 text-muted" />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{car.model}</span>
          <span className="block truncate text-xs text-muted">{car.color}</span>
        </span>
      </p>
      <Plate plate={car.plate} />
    </div>
  )
}
