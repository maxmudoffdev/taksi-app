import { formatPlate } from '../../types'
import { cn } from './cn'

/** O'zbekiston davlat raqami ko'rinishida: [01 | A 123 BC  UZ] */
export default function Plate({ plate, className }: { plate: string; className?: string }) {
  const [region, ...rest] = formatPlate(plate).split(' ')
  return (
    <span
      className={cn(
        'inline-flex h-8 items-stretch overflow-hidden rounded-lg border-2 border-neutral-900 bg-white font-mono text-[15px] leading-none font-bold tracking-wide text-neutral-900',
        className,
      )}
      aria-label={`Davlat raqami ${formatPlate(plate)}`}
    >
      <span className="flex items-center border-r-2 border-neutral-900 px-1.5">{region}</span>
      <span className="flex items-center px-2">{rest.join(' ')}</span>
      <span className="flex flex-col items-center justify-center pr-1.5 text-[7px] leading-tight font-black text-sky-700">
        <span className="flex h-1.5 w-2.5 flex-col overflow-hidden rounded-[1px]">
          <span className="flex-1 bg-sky-500" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-emerald-500" />
        </span>
        UZ
      </span>
    </span>
  )
}
