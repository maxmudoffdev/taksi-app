import { cn } from './cn'

export default function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-45',
        checked ? 'bg-emerald-500' : 'bg-line',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
      )}
    >
      <span className={cn('absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform', checked && 'translate-x-6')} />
    </button>
  )
}
