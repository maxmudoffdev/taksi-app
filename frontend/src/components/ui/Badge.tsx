import type { ReactNode } from 'react'
import { cn } from './cn'

type Tone = 'neutral' | 'brand' | 'success' | 'info' | 'warning' | 'danger' | 'violet'

const tones: Record<Tone, string> = {
  neutral: 'bg-subtle text-muted',
  brand: 'bg-brand-soft text-amber-800 dark:text-brand',
  success: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
  info: 'bg-sky-500/12 text-sky-700 dark:text-sky-400',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  danger: 'bg-red-500/12 text-red-600 dark:text-red-400',
  violet: 'bg-violet-500/12 text-violet-700 dark:text-violet-400',
}

export default function Badge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold [&>svg]:size-3.5', tones[tone], className)}>
      {icon}
      {children}
    </span>
  )
}
