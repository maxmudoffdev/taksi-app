import { Lock, Mail, Phone, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import RolePicker from '../../components/auth/RolePicker'
import CarFields from '../../components/driver/CarFields'
import { EMPTY_CAR, type CarDraft } from '../../components/driver/carOptions'
import Button from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { authErrorMessage, dashboardPath, signUp, type SignUpInput } from '../../services/auth'
import { useAuthStore } from '../../store/authStore'
import { isValidPlate, normalizePlate } from '../../types'
import { normalizeUzPhone } from '../../utils/phone'

export default function RegisterPage() {
  const { profile, loading } = useAuthStore()
  const [form, setForm] = useState<SignUpInput>({ email: '', password: '', fullName: '', phone: '', role: 'passenger' })
  const [car, setCar] = useState<CarDraft>(EMPTY_CAR)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && profile) return <Navigate to={dashboardPath[profile.role]} replace />

  const set = <K extends keyof SignUpInput>(key: K, value: SignUpInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const phone = normalizeUzPhone(form.phone)
    if (!phone) return setError('Telefon raqami noto‘g‘ri. Masalan: 90 123 45 67')
    const isDriver = form.role === 'driver'
    if (isDriver && !car.color) return setError('Mashina rangini tanlang')
    if (isDriver && !isValidPlate(car.plate)) return setError('Davlat raqami noto‘g‘ri. Masalan: 01 A 123 BC')
    setSubmitting(true)
    try {
      const { needsEmailConfirm } = await signUp({
        ...form,
        phone,
        car: isDriver ? { model: car.model.trim(), color: car.color, plate: normalizePlate(car.plate) } : undefined,
      })
      if (needsEmailConfirm) setInfo('Emailingizga tasdiqlash xati yuborildi. Tasdiqlagach, tizimga kiring.')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Ro‘yxatdan o‘tish" subtitle="Bir daqiqa vaqt oladi">
      <form onSubmit={onSubmit} className="space-y-4">
        <RolePicker value={form.role} onChange={(v) => set('role', v)} />
        <Field label="Ism familiya" icon={<User />} autoComplete="name" placeholder="Ali Valiyev" required value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        <Field label="Telefon" icon={<Phone />} prefix="+998" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="90 123 45 67" required value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <Field label="Email" icon={<Mail />} type="email" autoComplete="email" placeholder="siz@email.uz" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        {form.role === 'driver' && (
          <fieldset className="space-y-4 rounded-3xl border border-line p-4">
            <legend className="px-1 text-sm font-semibold">Mashinangiz</legend>
            <CarFields value={car} onChange={setCar} />
          </fieldset>
        )}
        <Field label="Parol" icon={<Lock />} type="password" autoComplete="new-password" placeholder="Kamida 6 belgi" required minLength={6} value={form.password} onChange={(e) => set('password', e.target.value)} />
        {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {info && <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{info}</p>}
        <Button type="submit" size="lg" block loading={submitting}>
          Hisob yaratish
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Hisobingiz bormi?{' '}
        <Link to="/login/email" className="font-semibold text-fg underline decoration-brand decoration-2 underline-offset-4">
          Kirish
        </Link>
      </p>
    </AuthLayout>
  )
}
