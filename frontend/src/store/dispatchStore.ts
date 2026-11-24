import { create } from 'zustand'
import { request } from '../services/socket'
import type { LatLng, Order, Tariff } from '../types'

export type CustomerHistory = {
  phone: string
  name: string | null
  /** lat/lng null — avval faqat mo'ljal matni bilan berilgan */
  pickups: { lat: number | null; lng: number | null; address: string | null; note: string | null }[]
  dropoffs: (LatLng & { address: string | null })[]
  /** Shu raqamdagi hozirgi faol buyurtmalar soni */
  activeCount: number
}

export type PhoneOrderInput = {
  customerPhone: string
  customerName: string | null
  /** null — joy xaritada belgilanmagan, faqat mo'ljal */
  pickup: LatLng | null
  pickupAddress: string | null
  pickupNote: string | null
  dropoff: LatLng | null
  dropoffAddress: string | null
  tariff: Tariff
  assignDriverId: string | null
  /** Nechta mashina (1–5) */
  carCount: number
  /** Raqamda faol buyurtma bo'lsa ham yaratish (dispetcher tasdiqlagan) */
  confirmDuplicate?: boolean
}

export type CreateResult = { order: Order; orders: Order[]; assignError: string | null; partialError: string | null }

type DispatchState = {
  lookup: (phone: string) => Promise<CustomerHistory | null>
  create: (input: PhoneOrderInput) => Promise<CreateResult>
  assign: (orderId: string, driverId: string) => Promise<Order>
}

export const useDispatchStore = create<DispatchState>(() => ({
  lookup: (phone) => request<CustomerHistory | null>('dispatch:lookup', { phone }),
  create: (input) => request<CreateResult>('dispatch:create', input),
  assign: (orderId, driverId) => request<Order>('dispatch:assign', { orderId, driverId }),
}))

/** Raqamdan faqat raqamlarni olib, 9 xonali mahalliy ko'rinishga (901234567) keltirish */
export function localDigits(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.startsWith('998') && d.length > 9 ? d.slice(3) : d
}

/** "901234567" → "90 123 45 67" */
export function formatLocalPhone(phone: string): string {
  const d = localDigits(phone).slice(0, 9)
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
}
