import { CarFront } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { request } from '../../services/socket'
import { useAuthStore } from '../../store/authStore'
import { isValidPlate, type CarInfo } from '../../types'
import Button from '../ui/Button'
import CarFields from './CarFields'
import { EMPTY_CAR, type CarDraft } from './carOptions'

/** Haydovchi mashina ma'lumotini kiritadi / o'zgartiradi */
export default function CarForm({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const hadCar = Boolean(profile?.car_plate)
  const [car, setCar] = useState<CarDraft>(() =>
    profile?.car_plate ? { model: profile.car_model ?? '', color: profile.car_color ?? '', plate: profile.car_plate } : EMPTY_CAR,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plateChanged = hadCar && profile?.car_plate !== car.plate.replace(/[^0-9a-z]/gi, '').toUpperCase()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!car.color) return setError('Mashina rangini tanlang')
    if (!isValidPlate(car.plate)) return setError('Davlat raqami noto‘g‘ri. Masalan: 01 A 123 BC')
    if (plateChanged && profile?.is_approved && !confirm('Boshqa mashinaga o‘tsangiz, admin qayta tasdiqlashi kerak bo‘ladi. Davom etasizmi?')) return
    setBusy(true)
    setError(null)
    try {
      await request<{ car: CarInfo; needsApproval: boolean }>('driver:car', car)
      await refreshProfile()
      onDone?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-amber-700 dark:text-brand">
          <CarFront className="size-6" />
        </span>
        <div>
          <p className="text-lg font-extrabold tracking-tight">{hadCar ? 'Mashina ma’lumoti' : 'Mashinangizni kiriting'}</p>
          <p className="text-sm text-muted">Yo‘lovchiga ko‘rsatiladi — sizni tez topadi.</p>
        </div>
      </div>
      <CarFields value={car} onChange={setCar} />
      {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Bekor qilish
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={busy}>
          Saqlash
        </Button>
      </div>
    </form>
  )
}
