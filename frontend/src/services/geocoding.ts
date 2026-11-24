import type { LatLng } from '../types'

const BASE = 'https://nominatim.openstreetmap.org'
/** Nominatim qoidasi: sekundiga ko'pi bilan 1 ta so'rov */
const MIN_GAP_MS = 1100
/** Toshkent atrofi — natijalarda ustunlik beriladi (lekin cheklanmaydi) */
const VIEWBOX = '68.9,41.5,69.6,41.1'

export interface Place extends LatLng {
  /** Asosiy nom: "Chorsu" yoki "Amir Temur ko'chasi, 15" */
  label: string
  /** Qo'shimcha: tuman, shahar */
  sublabel: string
}

type NominatimItem = {
  lat: string
  lon: string
  name?: string
  display_name: string
  address?: Record<string, string>
}

function toPlace(item: NominatimItem): Place {
  const a = item.address ?? {}
  const street = [a.road, a.house_number].filter(Boolean).join(', ')
  // Ba'zan `name` faqat uy raqami bo'ladi ("5") — u holda ko'cha nomi bilan birga ko'rsatamiz
  const nameIsJustNumber = !!item.name && /^\d+[\w/-]*$/.test(item.name.trim())
  const label = (!nameIsJustNumber && item.name) || street || item.display_name.split(',').slice(0, 2).join(',').trim()
  const area = [a.neighbourhood ?? a.suburb, a.city_district ?? a.district, a.city ?? a.town ?? a.village ?? a.state]
    .filter((x) => x && x !== label)
  return {
    lat: Number(item.lat),
    lng: Number(item.lon),
    label,
    sublabel: [...new Set(area)].slice(0, 3).join(', '),
  }
}

// So'rovlarni navbat bilan yuborish (bir vaqtda bittadan, oraliq ≥ 1.1 s)
let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastRequestAt = Date.now()
    return fn()
  })
  queue = run.catch(() => {})
  return run
}

const cache = new Map<string, Place[]>()

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { 'Accept-Language': 'uz,ru' } })
  if (!res.ok) throw new Error(`Manzil xizmati xatosi: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

/** Matn bo'yicha joylarni qidirish (O'zbekiston ichida) */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  const key = q.toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'uz',
    limit: '6',
    viewbox: VIEWBOX,
    'accept-language': 'uz',
  })
  const items = await throttled(() => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return getJson<NominatimItem[]>(`${BASE}/search?${params}`, signal)
  })
  const places = items.map(toPlace)
  cache.set(key, places)
  return places
}

/** Koordinatadan manzil (xaritada bosilgan nuqta uchun) */
export async function reverseGeocode(point: LatLng, signal?: AbortSignal): Promise<Place> {
  const params = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
    'accept-language': 'uz',
  })
  try {
    const item = await throttled(() => getJson<NominatimItem & { error?: string }>(`${BASE}/reverse?${params}`, signal))
    if (item.error) throw new Error(item.error)
    return { ...toPlace(item), lat: point.lat, lng: point.lng }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    // Manzil topilmasa ham nuqta ishlayveradi
    return { ...point, label: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`, sublabel: 'Xaritadagi nuqta' }
  }
}
