// Frontend va backend uchun umumiy turlar

export type UserRole = 'passenger' | 'driver' | 'admin' | 'dispatcher'

/** Buyurtma qayerdan kelgan: ilova yoki dispetcherga qo'ng'iroq */
export type OrderSource = 'app' | 'phone'

export type OrderStatus = 'created' | 'accepted' | 'arrived' | 'in_trip' | 'completed' | 'cancelled'

export type Tariff = 'economy' | 'comfort' | 'delivery'

/**
 * Bekor qilish sababi:
 *  passenger — yo'lovchi; driver — haydovchi; staff — dispetcher/admin;
 *  no_show — mijoz chiqmadi; timeout — haydovchi topilmadi; stale — uzoq vaqt osilib qolgan
 */
export type CancelReason = 'passenger' | 'driver' | 'staff' | 'no_show' | 'timeout' | 'stale'

export interface LatLng {
  lat: number
  lng: number
}

export interface Order {
  id: string
  /** Telefon buyurtmada null bo'lishi mumkin (mijoz ilovada yo'q) */
  passengerId: string | null
  driverId: string | null
  status: OrderStatus
  tariff: Tariff
  /** null — telefon buyurtmada joy xaritada belgilanmagan (faqat mo'ljal matni bor) */
  pickup: LatLng | null
  /** null — "qayerga" noma'lum (mijoz yo'lda aytadi) */
  dropoff: LatLng | null
  pickupAddress: string | null
  dropoffAddress: string | null
  distanceKm: number | null
  durationMin: number | null
  /** price_is_estimate bo'lsa — taxminiy (eng kam narx); yakuniy narxni haydovchi kiritadi */
  price: number
  priceIsEstimate: boolean
  source: OrderSource
  /** Mo'ljal: "maktab yonida, ko'k darvoza" */
  pickupNote: string | null
  /** Buyurtmani yaratgan dispetcher */
  createdBy: string | null
  /** Bekor qilingan bo'lsa — sababi */
  cancelReason: CancelReason | null
  createdAt: string
  updatedAt: string
  /** Haydovchi yetib kelgan vaqt (kutish shundan boshlanadi) */
  arrivedAt: string | null
  /** Safar boshlangan vaqt (kutish shu yerda tugaydi) */
  startedAt: string | null
  completedAt: string | null
  /** Bepul vaqtdan keyingi kutish haqi; yakuniy narx = price + waitingFee */
  waitingFee: number
  passengerName: string | null
  passengerPhone: string | null
  driverName: string | null
  driverPhone: string | null
  /** Haydovchi mashinasi (yo'lovchiga ko'rsatiladi) */
  driverCar: CarInfo | null
  /** Haydovchining o'rtacha bahosi va baholar soni */
  driverRating: number | null
  driverRatingCount: number
  /** Narx koeffitsiyenti: 1 — oddiy, >1 — talab yuqori bo'lgan payt */
  surge: number
  /** Yo'lovchi qo'ygan baho (1–5) */
  rating: number | null
  ratingComment: string | null
}

export interface CarInfo {
  model: string
  color: string
  /** "01A123BC" — ko'rsatishda formatPlate() bilan */
  plate: string
}

export interface DriverLocation {
  driverId: string
  lat: number
  lng: number
  heading: number | null
  updatedAt: string
}
export interface RouteInfo {
  distanceKm: number
  durationMin: number
  /** [lat, lng] juftliklari — Leaflet Polyline uchun */
  path: [number, number][]
}

/** Davlat raqamini yagona ko'rinishga keltirish: "01 a 123 bc" → "01A123BC" */
export function normalizePlate(v: string): string {
  return v.replace(/[^0-9a-z]/gi, '').toUpperCase()
}

/** "01A123BC" → "01 A 123 BC"; "01123ABC" → "01 123 ABC" */
export function formatPlate(plate: string): string {
  const p = normalizePlate(plate)
  const m = p.match(/^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/) ?? p.match(/^(\d{2})(\d{3})([A-Z]{3})$/)
  return m ? m.slice(1).join(' ') : p
}

/** O'zbekiston davlat raqamiga o'xshaydimi (jismoniy va yuridik shaxs formatlari) */
export function isValidPlate(plate: string): boolean {
  const p = normalizePlate(plate)
  return /^\d{2}[A-Z]\d{3}[A-Z]{2}$/.test(p) || /^\d{2}\d{3}[A-Z]{3}$/.test(p)
}
