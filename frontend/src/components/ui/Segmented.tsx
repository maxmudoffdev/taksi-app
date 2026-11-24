import type { ReactNode } from 'react'
import { cn } from './cn'

type Option<T extends string> = { value: T; label: ReactNode }

/** iOS uslubidagi tanlagich */
export default function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" className={cn('flex rounded-2xl bg-subtle p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition [&>svg]:size-4',
            value === o.value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
