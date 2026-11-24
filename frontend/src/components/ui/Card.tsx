import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export default function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('rounded-3xl border border-line/70 bg-surface p-4 shadow-card', className)} />
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-base font-bold tracking-tight">{children}</h3>
      {action}
    </div>
  )
}
