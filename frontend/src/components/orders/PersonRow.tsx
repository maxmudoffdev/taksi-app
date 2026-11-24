import { Phone } from 'lucide-react'
import type { ReactNode } from 'react'
import Avatar from '../ui/Avatar'
import { cn } from '../ui/cn'

/** Haydovchi / yo'lovchi qatori: avatar, ism, qo'ng'iroq tugmasi */
export default function PersonRow({
  label,
  name,
  phone,
  showPhone,
  highlightCall,
  meta,
  children,
}: {
  label: string
  name: string | null
  phone: string | null
  showPhone?: boolean
  highlightCall?: boolean
  /** Ism yonida (masalan, reyting) */
  meta?: ReactNode
  /** Pastki qism (masalan, mashina va davlat raqami) */
  children?: ReactNode
}) {
  return (
    <div className="rounded-2xl bg-subtle p-3">
      <div className="flex items-center gap-3">
        <Avatar name={name} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{label}</p>
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold">{name ?? label}</span>
            {meta}
          </p>
          {showPhone && phone && <p className="text-xs text-muted tabular-nums">{phone}</p>}
        </div>
        {phone && (
          <a
            href={`tel:${phone}`}
            aria-label="Qo‘ng‘iroq qilish"
            className={cn(
              'flex size-12 items-center justify-center rounded-full transition active:scale-95',
              highlightCall ? 'bg-emerald-500 text-white shadow-card' : 'bg-surface text-fg shadow-card',
            )}
          >
            <Phone className="size-5" />
          </a>
        )}
      </div>
      {children && <div className="mt-3 border-t border-line pt-3">{children}</div>}
    </div>
  )
}
