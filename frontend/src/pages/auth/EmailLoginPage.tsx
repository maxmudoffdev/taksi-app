import { Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import Button from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { authErrorMessage, dashboardPath, signIn } from '../../services/auth'
import { useAuthStore } from '../../store/authStore'

export default function EmailLoginPage() {
  const { profile, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && profile) return <Navigate to={dashboardPath[profile.role]} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Email bilan kirish" subtitle="Email va parolingizni kiriting">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" icon={<Mail />} type="email" autoComplete="email" placeholder="siz@email.uz" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Parol" icon={<Lock />} type="password" autoComplete="current-password" placeholder="••••••" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-sm font-medium text-muted hover:text-fg">
            Parolni unutdingizmi?
          </Link>
        </div>
        {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" size="lg" block loading={submitting}>
          Kirish
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Hisobingiz yo‘qmi?{' '}
        <Link to="/register" className="font-semibold text-fg underline decoration-brand decoration-2 underline-offset-4">
          Ro‘yxatdan o‘tish
        </Link>
      </p>
      <p className="mt-3 text-center text-sm">
        <Link to="/login" className="font-medium text-muted hover:text-fg">
          ← Telegram orqali kirish
        </Link>
      </p>
    </AuthLayout>
  )
}
