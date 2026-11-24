import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import Button from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { authErrorMessage, sendPasswordReset } from '../../services/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Parolni tiklash" subtitle="Emailingizga yangi parol o‘rnatish havolasini yuboramiz">
      {sent ? (
        <div className="space-y-4 rounded-3xl bg-emerald-500/10 p-5 text-center">
          <MailCheck className="mx-auto size-10 text-emerald-600" />
          <p className="font-semibold">Havola yuborildi</p>
          <p className="text-sm text-muted">
            <b className="text-fg">{email}</b> pochtasini tekshiring (Spam papkasini ham). Havolani bosib, yangi parol o‘rnating.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" icon={<Mail />} type="email" autoComplete="email" placeholder="siz@email.uz" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" size="lg" block loading={submitting}>
            Havola yuborish
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login/email" className="inline-flex items-center gap-1.5 font-semibold text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Kirish sahifasiga
        </Link>
      </p>
    </AuthLayout>
  )
}
