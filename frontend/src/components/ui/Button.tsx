import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'dark' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong shadow-sm',
  dark: 'bg-ink text-on-ink hover:opacity-90',
  secondary: 'bg-subtle text-fg hover:bg-line',
  outline: 'border border-line bg-surface text-fg hover:bg-subtle',
  ghost: 'text-fg hover:bg-subtle',
  danger: 'bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-400',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-2xl',
  lg: 'h-14 px-5 text-base gap-2 rounded-2xl',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  block?: boolean
  loading?: boolean
  icon?: ReactNode
}

export default function Button({ variant = 'primary', size = 'md', block, loading, icon, className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

/** Faqat ikonkali dumaloq tugma */
export function IconButton({ className, children, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-fg shadow-card transition hover:bg-subtle active:scale-95 disabled:opacity-45',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        className,
      )}
    >
      {children}
    </button>
  )
}
