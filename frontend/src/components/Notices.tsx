import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useOrderStore } from '../store/orderStore'
import { cn } from './ui/cn'

const tone = {
  info: { icon: Info, cls: 'text-sky-500' },
  success: { icon: CheckCircle2, cls: 'text-emerald-500' },
  warning: { icon: TriangleAlert, cls: 'text-amber-500' },
} as const

/** Ekran tepasidagi qisqa bildirishnomalar */
export default function Notices() {
  const { notices, dismissNotice } = useOrderStore()
  if (!notices.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] z-[3000] flex flex-col items-center gap-2 px-3" aria-live="polite">
      {notices.map((n) => {
        const { icon: Icon, cls } = tone[n.tone]
        return (
          <div
            key={n.id}
            className="pointer-events-auto flex w-full max-w-md animate-toast-in items-start gap-3 rounded-2xl border border-line bg-surface/95 p-3.5 shadow-float backdrop-blur-md"
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', cls)} />
            <p className="flex-1 text-sm font-medium">{n.text}</p>
            <button onClick={() => dismissNotice(n.id)} className="text-muted hover:text-fg" aria-label="Yopish">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
