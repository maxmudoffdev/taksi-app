import { cn } from './cn'

const initials = (name: string | null | undefined) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?'

export default function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-on-ink', className)}>
      {initials(name)}
    </span>
  )
}
