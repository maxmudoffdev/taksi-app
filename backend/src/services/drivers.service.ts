import { isValidPlate, normalizePlate, type CarInfo, type DriverLocation, type LatLng } from '../../../shared/types'
import type { SocketUser } from '../auth.js'
import { db } from '../supabase.js'
import { dbError, OrderError } from './orders.service.js'

type LocationInput = LatLng & { heading?: number | null }

export function isValidLocation(v: unknown): v is LocationInput {
  const p = v as LocationInput
  return (
    typeof p === 'object' && p !== null &&
    Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 &&
    (p.heading == null || Number.isFinite(p.heading))
  )
}

export async function saveLocation(driverId: string, loc: LocationInput, isOnline: boolean): Promise<DriverLocation> {
  const updatedAt = new Date().toISOString()
  const heading = loc.heading == null ? null : Math.round(((loc.heading % 360) + 360) % 360)
  const { error } = await db().from('driver_locations').upsert({
    driver_id: driverId,
    location: `SRID=4326;POINT(${loc.lng} ${loc.lat})`,
    heading,
    is_online: isOnline,
    updated_at: updatedAt,
  })
  if (error) throw dbError(error)
  return { driverId, lat: loc.lat, lng: loc.lng, heading, updatedAt }
}

export async function setOnline(driverId: string, isOnline: boolean): Promise<void> {
  const { error } = await db().from('driver_locations').update({ is_online: isOnline }).eq('driver_id', driverId)
  if (error) throw dbError(error)
}

export async function getLocation(driverId: string): Promise<DriverLocation | null> {
  const { data, error } = await db()
    .from('driver_locations_view')
    .select('driver_id, lat, lng, heading, updated_at')
    .eq('driver_id', driverId)
    .maybeSingle()
  if (error) throw dbError(error)
  return data
    ? { driverId: data.driver_id, lat: data.lat, lng: data.lng, heading: data.heading, updatedAt: data.updated_at }
    : null
}

/**
 * Haydovchi mashina ma'lumotini kiritadi / o'zgartiradi.
 * Tasdiqlangan haydovchi mashinasini (raqamini) almashtirsa — admin qayta tasdiqlashi kerak.
 */
export async function updateCar(user: SocketUser, input: unknown): Promise<{ car: CarInfo; needsApproval: boolean }> {
  if (user.role !== 'driver') throw new OrderError('Faqat haydovchi uchun')
  const i = (input ?? {}) as Record<string, unknown>
  const model = typeof i.model === 'string' ? i.model.trim().replace(/\s+/g, ' ').slice(0, 60) : ''
  const color = typeof i.color === 'string' ? i.color.trim().replace(/\s+/g, ' ').slice(0, 30) : ''
  const plate = typeof i.plate === 'string' ? normalizePlate(i.plate) : ''
  if (model.length < 2) throw new OrderError('Mashina rusumini yozing (masalan: Chevrolet Cobalt)')
  if (color.length < 2) throw new OrderError('Mashina rangini yozing')
  if (!isValidPlate(plate)) throw new OrderError("Davlat raqami noto'g'ri (masalan: 01 A 123 BC)")

  const { data: current, error: cErr } = await db().from('users').select('*').eq('id', user.id).maybeSingle()
  if (cErr) throw dbError(cErr)
  if (!current) throw new OrderError('Profil topilmadi')
  // Birinchi marta kiritish tasdiqni bekor qilmaydi; boshqa mashinaga o'tish — qayta tekshiruv
  const plateChanged = Boolean(current.car_plate) && current.car_plate !== plate
  const needsApproval = plateChanged && current.is_approved

  const { error } = await db()
    .from('users')
    .update({ car_model: model, car_color: color, car_plate: plate, ...(needsApproval && { is_approved: false }) })
    .eq('id', user.id)
  if (error) {
    if (error.code === '23505') throw new OrderError('Bu davlat raqami boshqa haydovchida ro‘yxatdan o‘tgan')
    throw dbError(error)
  }
  if (needsApproval) user.isApproved = false
  return { car: { model, color, plate }, needsApproval }
}
