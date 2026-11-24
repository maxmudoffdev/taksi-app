import { Star } from 'lucide-react'
import { useState } from 'react'
import { cn } from './cn'

/** Baho ko'rsatish: ★ 4.8 (12) */
export function RatingBadge({ rating, count, className }: { rating: number | null; count?: number; className?: string }) {
  if (rating == null) return <span className={cn('text-xs text-muted', className)}>Yangi haydovchi</span>
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', className)}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" />
      {rating.toFixed(1)}
      {count != null && <span className="font-normal text-muted">({count})</span>}
    </span>
  )
}

/** 1–5 yulduz tanlash */
export function StarInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="flex justify-center gap-1" role="radiogroup" aria-label="Baho" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} yulduz`}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="rounded-full p-1 transition active:scale-90 disabled:opacity-50"
        >
          <Star className={cn('size-9 transition', n <= shown ? 'fill-amber-400 text-amber-400' : 'text-line')} />
        </button>
      ))}
    </div>
  )
}

/** Faqat ko'rsatish uchun yulduzlar qatori */
export function StarsRow({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} aria-label={`${value} yulduz`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-3.5', n <= value ? 'fill-amber-400 text-amber-400' : 'text-line')} />
      ))}
    </span>
  )
}
