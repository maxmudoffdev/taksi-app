import { Ban, LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { dashboardPath, signOut } from '../services/auth'
import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types'
import FullScreenLoader from './FullScreenLoader'
import Button from './ui/Button'

function BlockedScreen() {
  return (
    <main className="flex min-h-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-500/12 text-red-600 dark:text-red-400">
          <Ban className="size-8" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Hisob bloklangan</h1>
          <p className="mt-2 text-muted">Hisobingizdan foydalanish to‘xtatilgan. Sababini bilish uchun admin bilan bog‘laning.</p>
        </div>
        <Button variant="secondary" block icon={<LogOut className="size-4" />} onClick={() => signOut()}>
          Chiqish
        </Button>
      </div>
    </main>
  )
}

type Props = { role: UserRole | UserRole[]; children: ReactNode }

export default function ProtectedRoute({ role, children }: Props) {
  const { session, profile, loading } = useAuthStore()

  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <FullScreenLoader text="Profil topilmadi. 002_auth.sql ishga tushirilganini tekshiring." />
  if (profile.is_blocked) return <BlockedScreen />
  const allowed = Array.isArray(role) ? role : [role]
  if (!allowed.includes(profile.role)) return <Navigate to={dashboardPath[profile.role]} replace />
  return <>{children}</>
}
