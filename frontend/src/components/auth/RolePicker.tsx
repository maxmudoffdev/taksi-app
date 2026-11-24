import { Car, UserRound } from 'lucide-react'
import { cn } from '../ui/cn'

export type SignupRole = 'passenger' | 'driver'

const ROLES: { value: SignupRole; label: string; hint: string; icon: typeof Car }[] = [
  { value: 'passenger', label: 'Yo‘lovchi', hint: 'Taksi chaqiraman', icon: UserRound },
  { value: 'driver', label: 'Haydovchi', hint: 'Buyurtma olaman', icon: Car },
]

/** Ro'yxatdan o'tishda rol tanlash: yo'lovchi yoki haydovchi */
export default function RolePicker({ value, onChange }: { value: SignupRole; onChange: (v: SignupRole) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Rol">
      {ROLES.map(({ value: v, label, hint, icon: Icon }) => {
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              'rounded-3xl border-2 p-4 text-left transition',
              active ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-muted/40',
            )}
          >
            <span className={cn('flex size-10 items-center justify-center rounded-2xl', active ? 'bg-brand text-on-brand' : 'bg-subtle text-muted')}>
              <Icon className="size-5" />
            </span>
            <span className="mt-3 block font-semibold">{label}</span>
            <span className="text-xs text-muted">{hint}</span>
          </button>
        )
      })}
    </div>
  )
}
