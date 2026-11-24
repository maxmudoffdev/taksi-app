import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  icon?: ReactNode
  suffix?: ReactNode
  prefix?: ReactNode
  hint?: string
}

/** Belgili kiritish maydoni (ikonka / prefiks / suffiks bilan) */
export const Field = forwardRef<HTMLInputElement, Props>(function Field({ label, icon, suffix, prefix, hint, className, ...rest }, ref) {
  return (
    <label className={cn('block text-sm', className)}>
      {label && <span className="mb-1.5 block font-medium text-muted">{label}</span>}
      <span className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/20">
        {icon && <span className="text-muted [&>svg]:size-[18px]">{icon}</span>}
        {prefix && <span className="text-muted">{prefix}</span>}
        <input ref={ref} {...rest} className="h-full w-full min-w-0 bg-transparent text-[15px] text-fg outline-none placeholder:text-muted/80" />
        {suffix && <span className="shrink-0 text-xs text-muted">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
})

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(
        'w-full resize-none rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] text-fg outline-none transition placeholder:text-muted/80 focus:border-brand focus:ring-4 focus:ring-brand/20',
        className,
      )}
    />
  )
}
