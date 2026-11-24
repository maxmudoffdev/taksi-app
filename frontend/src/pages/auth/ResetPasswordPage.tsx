import { CheckCircle2, Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import Button from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { authErrorMessage, dashboardPath, updatePassword } from '../../services/auth'
import { useAuthStore } from '../../store/authStore'

/** Emaildagi havola shu sahifani ochadi; supabase-js havoladagi tokendan sessiyani o'zi tiklaydi */
export default function ResetPasswordPage() {
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const loading = useAuthStore((s) => s.loading)
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Havola xatosi (muddati o'tgan) URL'da keladi
  const [linkError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('error_description'))

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => navigate(profile ? dashboardPath[profile.role] : '/login', { replace: true }), 1500)
    return () => clearTimeout(t)
  }, [done, profile, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== repeat) return setError('Parollar bir xil emas')
    setError(null)
    setSubmitting(true)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const noSession = !loading && !session

  return (
    <AuthLayout title="Yangi parol" subtitle="Hisobingiz uchun yangi parol o‘rnating">
      {done ? (
        <div className="space-y-3 rounded-3xl bg-emerald-500/10 p-5 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <p className="font-semibold">Parol yangilandi</p>
          <p className="text-sm text-muted">Hisobingizga o‘tilmoqda…</p>
        </div>
      ) : noSession || linkError ? (
        <div className="space-y-4">
          <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {linkError ? `Havola yaroqsiz: ${linkError}` : 'Havola eskirgan yoki allaqachon ishlatilgan.'}
          </p>
          <Link
            to="/forgot-password"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand font-semibold text-on-brand hover:bg-brand-strong"
          >
            Yangi havola olish
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Yangi parol" icon={<Lock />} type="password" autoComplete="new-password" placeholder="Kamida 6 belgi" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field label="Parolni takrorlang" icon={<Lock />} type="password" autoComplete="new-password" required minLength={6} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" size="lg" block loading={submitting || loading}>
            Saqlash
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
