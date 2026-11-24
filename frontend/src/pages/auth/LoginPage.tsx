import { ArrowLeft, KeyRound, Phone, Send, User } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import RolePicker, { type SignupRole } from '../../components/auth/RolePicker'
import CarFields from '../../components/driver/CarFields'
import { EMPTY_CAR, type CarDraft } from '../../components/driver/carOptions'
import Button from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { authErrorMessage, dashboardPath } from '../../services/auth'
import { tgConfig, tgRegister, tgResend, tgStart, tgStatus, tgVerify, type TgConfig } from '../../services/telegramAuth'
import { useAuthStore } from '../../store/authStore'
import { isValidPlate, normalizePlate } from '../../types'
import { normalizeUzPhone } from '../../utils/phone'

type Step = { kind: 'phone' } | { kind: 'bot'; nonce: string; botUrl: string } | { kind: 'code' } | { kind: 'profile'; ticket: string }

const prettyPhone = (p: string) => p.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4')

/** Telegram orqali kirish: telefon → (bir marta botda raqamni ulash) → kod → (yangi bo'lsa) ism va rol */
export default function LoginPage() {
  const { profile, loading } = useAuthStore()
  const [config, setConfig] = useState<TgConfig | null>(null)
  const [step, setStep] = useState<Step>({ kind: 'phone' })
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    tgConfig().then(setConfig, () => setConfig({ enabled: false, bot: null }))
  }, [])

  // Qayta yuborish taymeri
  useEffect(() => {
    if (resendAt <= now) return
    const t = setTimeout(() => setNow(Date.now()), 1000)
    return () => clearTimeout(t)
  }, [resendAt, now])

  const codeSent = (resendIn: number) => {
    setCode('')
    setNow(Date.now())
    setResendAt(Date.now() + resendIn * 1000)
    setStep({ kind: 'code' })
  }

  // Botda raqam ulanishini kutish
  const nonce = step.kind === 'bot' ? step.nonce : null
  useEffect(() => {
    if (!nonce) return
    let stopped = false
    const poll = async () => {
      if (stopped) return
      try {
        const s = await tgStatus(nonce)
        if (stopped) return
        if (s.status === 'code_sent') return codeSent(s.resendIn ?? 60)
        if (s.status === 'mismatch') {
          setError('Telegram hisobingiz raqami kiritilgan raqamga mos emas. Telegram’dagi raqamingizni kiriting.')
          return setStep({ kind: 'phone' })
        }
        if (s.status === 'expired') {
          setError('Vaqt tugadi. Qaytadan urining.')
          return setStep({ kind: 'phone' })
        }
      } catch {
        // tarmoq uzilishi — keyingi urinishda
      }
      setTimeout(poll, 2000)
    }
    const t = setTimeout(poll, 1500)
    return () => {
      stopped = true
      clearTimeout(t)
    }
  }, [nonce])

  if (!loading && profile) return <Navigate to={dashboardPath[profile.role]} replace />
  if (config && !config.enabled) return <Navigate to="/login/email" replace />

  const run = async (fn: () => Promise<void>) => {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onPhone = (e: FormEvent) => {
    e.preventDefault()
    const p = normalizeUzPhone(phoneInput)
    if (!p) return setError('Telefon raqami noto‘g‘ri. Masalan: 90 123 45 67')
    void run(async () => {
      setPhone(p)
      const r = await tgStart(p)
      if (r.status === 'code_sent') codeSent(r.resendIn)
      else setStep({ kind: 'bot', nonce: r.nonce, botUrl: r.botUrl })
    })
  }

  const submitCode = (value: string) =>
    run(async () => {
      const r = await tgVerify(phone, value)
      if (r.status === 'new') setStep({ kind: 'profile', ticket: r.ticket })
    })

  const onCodeChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length === 6 && !busy) void submitCode(digits)
  }

  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000))
  const back = () => {
    setError(null)
    setStep({ kind: 'phone' })
  }

  return (
    <AuthLayout
      title={step.kind === 'profile' ? 'Tanishib olaylik' : 'Xush kelibsiz'}
      subtitle={step.kind === 'profile' ? 'Hisobingiz bir daqiqada tayyor' : 'Telegram orqali parolsiz kiring'}
    >
      {step.kind === 'phone' && (
        <form onSubmit={onPhone} className="space-y-4">
          <Field
            label="Telefon raqamingiz"
            icon={<Phone />}
            prefix="+998"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="90 123 45 67"
            required
            autoFocus
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            hint="Kirish kodi Telegram’ga keladi"
          />
          <ErrorBox error={error} />
          <Button type="submit" size="lg" block loading={busy || !config} icon={<Send className="size-4" />}>
            Kod olish
          </Button>
        </form>
      )}

      {step.kind === 'bot' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-subtle p-5">
            <p className="font-semibold">Raqamingizni botga ulang</p>
            <p className="mt-1 text-sm text-muted">Faqat birinchi marta — keyin kod darhol keladi.</p>
            <ol className="mt-4 space-y-2 text-sm">
              <li>
                <b>1.</b> Pastdagi tugma orqali botni oching va <b>Start</b> ni bosing
              </li>
              <li>
                <b>2.</b> <b>«📱 Raqamni yuborish»</b> tugmasini bosing
              </li>
              <li>
                <b>3.</b> Kelgan 6 xonali kodni shu yerga kiriting
              </li>
            </ol>
          </div>
          <a
            href={step.botUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#229ED9] font-semibold text-white transition hover:brightness-105 active:scale-[0.99]"
          >
            <Send className="size-5" /> Telegram botni ochish
          </a>
          <p className="flex items-center justify-center gap-2 text-sm text-muted">
            <span className="size-2 animate-pulse rounded-full bg-brand" /> {prettyPhone(phone)} raqami kutilmoqda…
          </p>
          <ErrorBox error={error} />
          <BackButton onClick={back} />
        </div>
      )}

      {step.kind === 'code' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitCode(code)
          }}
          className="space-y-4"
        >
          <p className="text-sm text-muted">
            Kod Telegram’dagi botga yuborildi: <b className="text-fg">{prettyPhone(phone)}</b>
          </p>
          <Field
            label="Kirish kodi"
            icon={<KeyRound />}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            required
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            className="[&_input]:text-lg [&_input]:tracking-[0.4em] [&_input]:tabular-nums"
          />
          <ErrorBox error={error} />
          <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6}>
            Kirish
          </Button>
          <div className="flex items-center justify-between text-sm">
            <BackButton onClick={back} label="Raqamni o‘zgartirish" />
            <button
              type="button"
              disabled={resendIn > 0 || busy}
              onClick={() => run(async () => codeSent((await tgResend(phone)).resendIn))}
              className="font-medium text-muted hover:text-fg disabled:opacity-60"
            >
              {resendIn > 0 ? `Qayta yuborish ${resendIn} s` : 'Kodni qayta yuborish'}
            </button>
          </div>
        </form>
      )}

      {step.kind === 'profile' && <ProfileStep ticket={step.ticket} phone={phone} />}

      {step.kind !== 'profile' && (
        <p className="mt-6 text-center text-sm text-muted">
          Telegram yo‘qmi?{' '}
          <Link to="/login/email" className="font-semibold text-fg underline decoration-brand decoration-2 underline-offset-4">
            Email bilan kirish
          </Link>
        </p>
      )}
    </AuthLayout>
  )
}

/** Yangi raqam: ism, rol va (haydovchi bo'lsa) mashina */
function ProfileStep({ ticket, phone }: { ticket: string; phone: string }) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<SignupRole>('passenger')
  const [car, setCar] = useState<CarDraft>(EMPTY_CAR)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (fullName.trim().length < 2) return setError('Ismingizni yozing')
    const isDriver = role === 'driver'
    if (isDriver && !car.color) return setError('Mashina rangini tanlang')
    if (isDriver && !isValidPlate(car.plate)) return setError('Davlat raqami noto‘g‘ri. Masalan: 01 A 123 BC')
    setBusy(true)
    try {
      await tgRegister({
        ticket,
        fullName: fullName.trim(),
        role,
        car: isDriver ? { model: car.model.trim(), color: car.color, plate: normalizePlate(car.plate) } : undefined,
      })
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted">
        <b className="text-fg">{prettyPhone(phone)}</b> raqami tasdiqlandi ✅
      </p>
      <RolePicker value={role} onChange={setRole} />
      <Field
        label="Ism familiya"
        icon={<User />}
        autoComplete="name"
        placeholder="Ali Valiyev"
        required
        autoFocus
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      {role === 'driver' && (
        <fieldset className="space-y-4 rounded-3xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Mashinangiz</legend>
          <CarFields value={car} onChange={setCar} />
        </fieldset>
      )}
      <ErrorBox error={error} />
      <Button type="submit" size="lg" block loading={busy}>
        {role === 'driver' ? 'Hisob yaratish va tekshiruvga yuborish' : 'Boshlash'}
      </Button>
    </form>
  )
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null
  return <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
}

function BackButton({ onClick, label = 'Orqaga' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
      <ArrowLeft className="size-4" /> {label}
    </button>
  )
}
