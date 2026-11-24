import { create } from 'zustand'
import { isActive } from '../../../shared/orderStatus'
import type { TariffConfig } from '../services/pricing'
import { getSocket, request } from '../services/socket'
import { playAlert, vibrate } from '../utils/sound'
import { useAuthStore } from './authStore'
import { useTariffStore } from './tariffStore'
import type { DriverLocation, LatLng, Order, OrderStatus, Tariff, UserRole } from '../types'

export type Notice = { id: number; text: string; tone: 'info' | 'success' | 'warning' }

type OrderState = {
  role: UserRole | null
  connected: boolean
  connectionError: string | null
  activeOrder: Order | null
  /** Oxirgi yakunlangan/bekor qilingan buyurtma — natijani ko'rsatish uchun */
  finishedOrder: Order | null
  /** Yo'lovchi uchun: biriktirilgan haydovchining jonli joylashuvi */
  driverLocation: DriverLocation | null
  notices: Notice[]
  connect: (role: UserRole) => void
  disconnect: () => void
  createOrder: (input: {
    pickup: LatLng
    dropoff: LatLng
    pickupAddress: string | null
    dropoffAddress: string | null
    tariff: Tariff
    /** Yo'lovchi ko'rgan koeffitsiyent — server yuqoriroq hisoblasa, qayta tasdiq so'raydi */
    expectedSurge: number
  }) => Promise<Order>
  rateOrder: (orderId: string, rating: number, comment?: string) => Promise<Order>
  acceptOrder: (orderId: string) => Promise<Order>
  setStatus: (orderId: string, status: OrderStatus, extra?: { finalPrice?: number; reason?: 'no_show' }) => Promise<Order>
  dismissFinished: () => void
  notify: (text: string, tone?: Notice['tone']) => void
  dismissNotice: (id: number) => void
}

let noticeId = 0
/** Haydovchi o'zi qabul qilayotgan buyurtma — "dispetcher biriktirdi" xabari chiqmasligi uchun */
let acceptingOrderId: string | null = null
const NOTICE_TTL_MS = 6000
const BLOCKED_PREFIX = 'Hisobingiz bloklangan'

/** Status o'zgarishi haqida yo'lovchiga xabar */
function passengerMessage(prev: Order | null, next: Order): { text: string; tone: Notice['tone'] } | null {
  if (prev?.status === next.status) return null
  switch (next.status) {
    case 'accepted':
      return { text: `🚗 ${next.driverName ?? 'Haydovchi'} buyurtmangizni qabul qildi va yo‘lga chiqdi`, tone: 'info' }
    case 'arrived':
      return { text: '📍 Haydovchi yetib keldi — sizni kutmoqda', tone: 'info' }
    case 'in_trip':
      return { text: '🛣 Safar boshlandi', tone: 'info' }
    case 'completed':
      return { text: '✅ Safar yakunlandi. Rahmat!', tone: 'success' }
    case 'cancelled':
      if (!prev) return null
      if (next.cancelReason === 'timeout') return { text: '😔 Hozir bo‘sh haydovchi topilmadi. Birozdan keyin qayta urinib ko‘ring', tone: 'warning' }
      if (next.cancelReason === 'no_show') return { text: '🚫 Haydovchi sizni kutib, buyurtmani bekor qildi', tone: 'warning' }
      if (next.cancelReason === 'passenger') return null
      return { text: '🚫 Buyurtma bekor qilindi', tone: 'warning' }
    default:
      return null
  }
}

/** Brauzer bildirishnomasi — faqat ruxsat berilgan va sahifa fonda bo'lsa */
export function systemNotify(text: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return
  new Notification('🚕 Taksi', { body: text })
}

export const useOrderStore = create<OrderState>((set, get) => {
  const applyOrder = (order: Order) => {
    const { activeOrder: prev, finishedOrder, role } = get()
    const isCurrent = !prev || prev.id === order.id
    if (!isCurrent) return
    // Yopilgan buyurtmaning keyingi yangilanishi (masalan, baho) — faqat ko'rsatilayotgan bo'lsa, xabarsiz
    if (!prev && !isActive(order.status)) {
      if (finishedOrder?.id === order.id) set({ finishedOrder: order })
      return
    }

    if (role === 'passenger') {
      const msg = passengerMessage(prev, order)
      if (msg) {
        get().notify(msg.text, msg.tone)
        systemNotify(msg.text)
      }
    }
    if (role === 'driver' && !prev && order.status === 'accepted' && order.id !== acceptingOrderId) {
      const text = '📞 Dispetcher sizga buyurtma biriktirdi'
      get().notify(text, 'info')
      systemNotify(text)
      playAlert()
      vibrate()
    }
    if (role === 'driver' && prev && order.status === 'cancelled' && order.cancelReason !== 'driver' && order.cancelReason !== 'no_show') {
      get().notify(order.cancelReason === 'passenger' ? '🚫 Yo‘lovchi buyurtmani bekor qildi' : '🚫 Buyurtma bekor qilindi', 'warning')
      playAlert(1)
    }

    if (isActive(order.status)) set({ activeOrder: order, finishedOrder: null })
    else set({ activeOrder: null, finishedOrder: order, driverLocation: null })
  }

  return {
    role: null,
    connected: false,
    connectionError: null,
    activeOrder: null,
    finishedOrder: null,
    driverLocation: null,
    notices: [],

    connect: (role) => {
      set({ role })
      const s = getSocket()
      if (s.connected || s.active) return
      s.on('connect', () => set({ connected: true, connectionError: null }))
      s.on('disconnect', () => set({ connected: false }))
      s.on('connect_error', (e) => {
        set({ connected: false, connectionError: e.message })
        // Bloklangan — profil qayta yuklanadi va "bloklangan" ekrani chiqadi
        if (e.message.startsWith(BLOCKED_PREFIX)) useAuthStore.getState().refreshProfile()
      })
      s.on('account:blocked', () => useAuthStore.getState().refreshProfile())
      s.on('order:rated', ({ rating }: { orderId: string; rating: number }) => {
        if (get().role === 'driver') get().notify(`⭐ Yo‘lovchi safaringizga ${rating} baho qo‘ydi`, rating >= 4 ? 'success' : 'info')
      })
      s.on('server:error', (msg: string) => get().notify(msg, 'warning'))
      s.on('order:active', (order: Order | null) => set({ activeOrder: order, driverLocation: null }))
      s.on('tariffs', (tariffs: TariffConfig[]) => useTariffStore.getState().setTariffs(tariffs))
      s.on('tariffs:updated', (tariffs: TariffConfig[]) => {
        useTariffStore.getState().setTariffs(tariffs)
        if (get().role === 'passenger' && !get().activeOrder) get().notify('ℹ️ Tarif narxlari yangilandi', 'info')
      })
      // Admin tasdiqlasa/bloklasa — profilni qayta yuklaymiz
      s.on('profile:updated', () => useAuthStore.getState().refreshProfile())
      s.on('order:updated', applyOrder)
      s.on('driver:location', (loc: DriverLocation & { orderId: string | null }) => {
        if (get().role === 'passenger' && loc.orderId && loc.orderId === get().activeOrder?.id) set({ driverLocation: loc })
      })
      s.connect()
    },

    disconnect: () => {
      const s = getSocket()
      s.removeAllListeners()
      s.disconnect()
      set({ role: null, connected: false, activeOrder: null, finishedOrder: null, driverLocation: null })
    },

    createOrder: async (input) => {
      // Fon rejimida bildirishnoma olish uchun ruxsat so'raymiz (bir marta)
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }
      const order = await request<Order>('order:create', input)
      applyOrder(order)
      return order
    },

    acceptOrder: async (orderId) => {
      acceptingOrderId = orderId
      try {
        const order = await request<Order>('order:accept', { orderId })
        applyOrder(order)
        return order
      } finally {
        acceptingOrderId = null
      }
    },

    setStatus: async (orderId, status, extra) => {
      const order = await request<Order>('order:status', { orderId, status, ...extra })
      applyOrder(order)
      return order
    },

    rateOrder: async (orderId, rating, comment) => {
      const order = await request<Order>('order:rate', { orderId, rating, comment })
      if (get().finishedOrder?.id === order.id) set({ finishedOrder: order })
      return order
    },

    dismissFinished: () => set({ finishedOrder: null }),

    notify: (text, tone = 'info') => {
      const id = ++noticeId
      set((s) => ({ notices: [...s.notices, { id, text, tone }].slice(-3) }))
      setTimeout(() => get().dismissNotice(id), NOTICE_TTL_MS)
    },

    dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
  }
})
