import { AlertTriangle, History, Pin, Send, User } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import AddressInput, { RouteInputs } from '../../../components/places/AddressInput'
import { TariffIcon } from '../../../components/tariffs/tariffIcon'
import Button from '../../../components/ui/Button'
import { cn } from '../../../components/ui/cn'
import { Field, TextArea } from '../../../components/ui/Field'
import Segmented from '../../../components/ui/Segmented'
import type { usePlacePoint } from '../../../hooks/usePlacePoint'
import { distanceM, formatDistance } from '../../../maps/geo'
import { useSurge } from '../../../hooks/useSurge'
import { applySurge, calculatePrice, formatSum, formatSurge, LONG_ROUTE_KM } from '../../../services/pricing'
import { RequestError } from '../../../services/socket'
import type { DriverMarker } from '../../../store/adminStore'
import {
  formatLocalPhone,
  localDigits,
  useDispatchStore,
  type CustomerHistory,
  type PhoneOrderInput,
} from '../../../store/dispatchStore'
import { useOrderStore } from '../../../store/orderStore'
import { useTariffs } from '../../../store/tariffStore'
import type { RouteInfo, Tariff } from '../../../types'

type Point = ReturnType<typeof usePlacePoint>

type Props = {
  from: Point
  to: Point
  route: RouteInfo | null
  mapMode: 'A' | 'B'
  onMapModeChange: (m: 'A' | 'B') => void
  onFocus: (p: { lat: number; lng: number }) => void
  freeDrivers: DriverMarker[]
}

const LOOKUP_DEBOUNCE_MS = 400
const CAR_COUNTS = [1, 2, 3, 4, 5]

export default function NewCallForm({ from, to, route, mapMode, onMapModeChange, onFocus, freeDrivers }: Props) {
  const tariffs = useTariffs()
  const { lookup, create } = useDispatchStore()
  const notify = useOrderStore((s) => s.notify)
  const phoneRef = useRef<HTMLInputElement>(null)

  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [tariffId, setTariffId] = useState<Tariff>('economy')
  const { surge } = useSurge(from.place)
  const [assignTo, setAssignTo] = useState<string>('')
  const [carCount, setCarCount] = useState(1)
  const [history, setHistory] = useState<CustomerHistory | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const digits = localDigits(phone)
  const phoneComplete = digits.length === 9

  // Raqam to'liq yozilgach — mijozning oldingi buyurtmalarini qidiramiz
  useEffect(() => {
    if (!phoneComplete) return
    let cancelled = false
    const t = setTimeout(() => {
      lookup(digits)
        .then((h) => {
          if (cancelled) return
          setHistory(h)
          if (h?.name) setName((n) => n || h.name!)
        })
        .catch(() => {})
    }, LOOKUP_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [digits, phoneComplete, lookup])
  const shownHistory = phoneComplete && history?.phone.endsWith(digits) ? history : null

  const sortedDrivers = from.place
    ? [...freeDrivers].sort((a, b) => distanceM(from.place!, a) - distanceM(from.place!, b))
    : freeDrivers
  // Tanlangan haydovchi band bo'lib qolsa — tanlovni bekor qilamiz
  const assignValue = freeDrivers.some((d) => d.driverId === assignTo) ? assignTo : ''

  const reset = () => {
    setPhone('')
    setName('')
    setNote('')
    setAssignTo('')
    setCarCount(1)
    setHistory(null)
    from.clear()
    to.clear()
    onMapModeChange('A')
    phoneRef.current?.focus()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!phoneComplete) return setError('Telefon raqamini to‘liq kiriting: 90 123 45 67')
    if (!from.place && note.trim().length < 3) return setError('Joyni xaritada belgilang yoki mo‘ljalni yozing (masalan: 19-maktab yoni)')
    if (route && route.distanceKm > LONG_ROUTE_KM && !confirm(`Marshrut ${Math.round(route.distanceKm)} km — juda uzoq. Manzillar to‘g‘rimi?`)) return
    setSubmitting(true)
    setError(null)
    const input: PhoneOrderInput = {
      customerPhone: digits,
      customerName: name.trim() || null,
      pickup: from.place ? { lat: from.place.lat, lng: from.place.lng } : null,
      pickupAddress: from.place?.label || null,
      pickupNote: note.trim() || null,
      dropoff: to.place ? { lat: to.place.lat, lng: to.place.lng } : null,
      dropoffAddress: to.place?.label || null,
      tariff: tariffId,
      assignDriverId: assignValue || null,
      carCount,
    }
    try {
      let result
      try {
        result = await create(input)
      } catch (err) {
        // Raqamda faol buyurtma bor — tasodifiy takror emasligini dispetcher tasdiqlaydi
        if (err instanceof RequestError && err.code === 'DUPLICATE_ACTIVE') {
          if (!confirm(err.message)) return
          result = await create({ ...input, confirmDuplicate: true })
        } else throw err
      }
      const { orders, assignError, partialError } = result
      const what = orders.length > 1 ? `${orders.length} ta buyurtma` : 'Buyurtma'
      if (partialError) notify(`⚠️ ${partialError}`, 'warning')
      else if (assignError) notify(`⚠️ Haydovchiga biriktirilmadi (${assignError}). ${what} hammaga yuborildi.`, 'warning')
      else if (orders[0].driverId) notify(`✅ ${what} yaratildi, 1-mashina ${orders[0].driverName ?? 'haydovchi'}ga biriktirildi`, 'success')
      else notify(`✅ ${what} yaratildi va haydovchilarga yuborildi`, 'success')
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const priceFor = (t: (typeof tariffs)[number]) =>
    route ? formatSum(calculatePrice(t, route.distanceKm, route.durationMin, 0, surge).total) : `≥ ${formatSum(applySurge(t.minFare, surge))}`

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field
          ref={phoneRef}
          autoFocus
          label="Telefon *"
          prefix="+998"
          inputMode="tel"
          value={formatLocalPhone(phone)}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="90 123 45 67"
          className="[&_input]:font-mono [&_input]:tabular-nums"
        />
        <Field label="Ism" icon={<User />} value={name} onChange={(e) => setName(e.target.value)} placeholder="Mijoz ismi" />
      </div>

      {!!shownHistory?.activeCount && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-500/12 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Bu raqamda hozir {shownHistory.activeCount} ta faol buyurtma bor — yangi buyurtma qo‘shimcha mashina bo‘ladi
        </p>
      )}
      {shownHistory && shownHistory.pickups.length > 0 && (
        <div className="rounded-2xl border border-line p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <History className="size-3.5" /> Oldingi manzillar
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shownHistory.pickups.map((p) => (
              <button
                key={`${p.lat},${p.lng},${p.note}`}
                type="button"
                onClick={() => {
                  if (p.lat != null && p.lng != null) {
                    from.select({ lat: p.lat, lng: p.lng, label: p.address ?? 'Oldingi nuqta', sublabel: '' })
                    onFocus({ lat: p.lat, lng: p.lng })
                    onMapModeChange('B')
                  } else {
                    from.clear()
                  }
                  if (p.note) setNote(p.note)
                }}
                className="flex max-w-full items-center gap-1.5 truncate rounded-full bg-subtle px-3 py-1.5 text-left text-xs font-medium hover:bg-line"
                title={p.note ?? undefined}
              >
                <span className="size-2 shrink-0 rounded-full bg-ink" />
                {p.address ?? (p.lat == null ? 'Mo‘ljal' : 'Nuqta')}
                {p.note && <span className="truncate text-muted">· {p.note}</span>}
              </button>
            ))}
            {shownHistory.dropoffs.map((d) => (
              <button
                key={`b:${d.lat},${d.lng}`}
                type="button"
                onClick={() => to.select({ lat: d.lat, lng: d.lng, label: d.address ?? 'Oldingi manzil', sublabel: '' })}
                className="flex max-w-full items-center gap-1.5 truncate rounded-full bg-subtle px-3 py-1.5 text-xs font-medium hover:bg-line"
              >
                <span className="size-2 shrink-0 rounded-full bg-red-500" />
                {d.address ?? 'Nuqta'}
              </button>
            ))}
          </div>
        </div>
      )}

      <RouteInputs>
        <AddressInput
          marker="A"
          placeholder="Qayerdan? (ixtiyoriy)"
          value={from.place}
          resolving={from.resolving}
          onSelect={(p) => {
            from.select(p)
            onFocus(p)
            onMapModeChange('B')
          }}
          onClear={from.clear}
        />
        <AddressInput
          marker="B"
          placeholder="Qayerga? (ixtiyoriy)"
          value={to.place}
          resolving={to.resolving}
          onSelect={(p) => {
            to.select(p)
            onFocus(p)
          }}
          onClear={to.clear}
        />
      </RouteInputs>

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted">
          <Pin className="size-3.5" /> Mo‘ljal {!from.place && <span className="text-red-500">*</span>}
        </p>
        <TextArea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder={from.place ? 'Darvoza rangi, podyezd…' : 'Masalan: 19-maktab yoni, Navro‘z mahallasi'}
        />
        <p className="mt-1.5 text-xs text-muted">
          {!from.place
            ? 'Joyni bilmasangiz — faqat mo‘ljalni yozing. Haydovchi mijozga qo‘ng‘iroq qilib aniqlaydi.'
            : !to.place
              ? 'B bo‘sh qolsa — narx taxminiy, yakuniy narxni haydovchi kiritadi.'
              : route
                ? `Marshrut: ${route.distanceKm.toFixed(1)} km · ${route.durationMin} daqiqa`
                : ''}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted">Xaritada bosish</span>
        <Segmented
          className="w-44"
          value={mapMode}
          onChange={onMapModeChange}
          options={[
            { value: 'A', label: 'A nuqta' },
            { value: 'B', label: 'B nuqta' },
          ]}
        />
      </div>

      {surge > 1 && (
        <p className="rounded-2xl bg-amber-500/12 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          ⚡ Bu hududda talab yuqori — narx {formatSurge(surge)}. Mijozga ayting.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tarif">
        {tariffs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={tariffId === t.id}
            onClick={() => setTariffId(t.id)}
            className={cn(
              'rounded-2xl border-2 p-2.5 text-left text-sm transition',
              tariffId === t.id ? 'border-brand bg-brand-soft' : 'border-transparent bg-subtle hover:border-line',
            )}
          >
            <TariffIcon id={t.id} className="size-4" />
            <span className="mt-1 block truncate font-semibold">{t.name}</span>
            <span className="block text-xs font-bold">{priceFor(t)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[auto_1fr] items-end gap-3">
        <div>
          <p className="mb-1.5 text-sm font-medium text-muted">Mashina</p>
          <div className="flex gap-1">
            {CAR_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCarCount(n)}
                aria-pressed={carCount === n}
                className={cn('size-9 rounded-xl text-sm font-bold transition', carCount === n ? 'bg-ink text-on-ink' : 'bg-subtle hover:bg-line')}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="block min-w-0 text-sm">
          <span className="mb-1.5 block font-medium text-muted">{carCount > 1 ? 'Haydovchi (1-mashina)' : 'Haydovchi'}</span>
          <select
            value={assignValue}
            onChange={(e) => setAssignTo(e.target.value)}
            className="h-9 w-full truncate rounded-xl border border-line bg-subtle px-2 text-sm font-medium"
          >
            <option value="">Avtomatik — yaqinlarga</option>
            {sortedDrivers.map((d) => (
              <option key={d.driverId} value={d.driverId}>
                {d.fullName ?? 'Haydovchi'}
                {from.place ? ` — ${formatDistance(distanceM(from.place, d))}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!freeDrivers.length && <p className="text-xs text-muted">Hozir bo‘sh onlayn haydovchi yo‘q — buyurtma navbatda turadi.</p>}

      {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="lg"
          className="flex-1"
          icon={<Send className="size-5" />}
          loading={submitting}
          disabled={!phoneComplete || (!from.place && note.trim().length < 3)}
        >
          {carCount > 1 ? `${carCount} ta mashina` : assignValue ? 'Yaratish va biriktirish' : 'Buyurtma yaratish'}
        </Button>
        <Button type="button" size="lg" variant="secondary" onClick={reset}>
          Tozalash
        </Button>
      </div>
    </form>
  )
}
