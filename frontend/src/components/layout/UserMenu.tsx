import { History, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { signOut } from '../../services/auth'
import { useAuthStore } from '../../store/authStore'
import { useOrderStore } from '../../store/orderStore'
import Avatar from '../ui/Avatar'
import { cn } from '../ui/cn'

export const ROLE_LABEL = { passenger: "Yo'lovchi", driver: 'Haydovchi', admin: 'Admin', dispatcher: 'Dispetcher' } as const

/** Avatar + ochiladigan menyu (ism, rol, aloqa holati, chiqish) */
export default function UserMenu({ align = 'right' }: { align?: 'left' | 'right' }) {
  const profile = useAuthStore((s) => s.profile)
  const connected = useOrderStore((s) => s.connected)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full shadow-card transition active:scale-95"
        aria-label="Profil menyusi"
        aria-expanded={open}
      >
        <Avatar name={profile?.full_name} className="size-11 border-2 border-surface" />
        <span
          className={cn('absolute right-0 bottom-0 size-3 rounded-full border-2 border-surface', connected ? 'bg-emerald-500' : 'bg-red-500')}
          title={connected ? 'Onlayn' : 'Server bilan aloqa yo‘q'}
        />
      </button>
      {open && (
        <div
          className={cn(
            'absolute top-full z-[2100] mt-2 w-64 animate-toast-in rounded-3xl border border-line bg-surface p-2 shadow-float',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="flex items-center gap-3 p-3">
            <Avatar name={profile?.full_name} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile?.full_name ?? 'Foydalanuvchi'}</p>
              <p className="text-xs text-muted">
                {profile ? ROLE_LABEL[profile.role] : ''} · {connected ? 'onlayn' : 'aloqa yo‘q'}
              </p>
            </div>
          </div>
          {(profile?.role === 'passenger' || profile?.role === 'driver') && (
            <Link
              to="/history"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium hover:bg-subtle"
            >
              <History className="size-4" /> {profile.role === 'driver' ? 'Daromad va safarlar' : 'Mening safarlarim'}
            </Link>
          )}
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            <LogOut className="size-4" /> Chiqish
          </button>
        </div>
      )}
    </div>
  )
}
