import { create } from 'zustand'
import { isActive } from '../../../shared/orderStatus'
import type { TariffConfig, TariffPatch } from '../services/pricing'
import { getSocket, request } from '../services/socket'
import type { CarInfo, DriverLocation, Order, Tariff } from '../types'
import type { WalletDetails } from './walletStore'
import { useTariffStore } from './tariffStore'

export type DriverMarker = DriverLocation & { fullName: string | null; phone: string | null }

export type DriverRow = {
  id: string
  fullName: string | null
  phone: string | null
  isApproved: boolean
  isBlocked: boolean
  isOnline: boolean
  lastSeenAt: string | null
  createdAt: string
  car: CarInfo | null
  rating: number | null
  ratingCount: number
  /** Balans/ball tizimi (013) yoqilmagan bo'lsa — null */
  balance: number | null
  score: number | null
  redUntil: string | null
}

export type SurgeSettings = { enabled: boolean; max: number }

export type OrderSearch = {
  q?: string
  status?: string
  source?: 'app' | 'phone' | 'all'
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export type AdminStats = {
  onlineDrivers: number
  activeOrders: number
  searchingOrders: number
  completedToday: number
  revenueToday: number
}

type Snapshot = { drivers: DriverMarker[]; orders: Order[]; stats: AdminStats }

type AdminState = {
  drivers: Record<string, DriverMarker>
  orders: Order[]
  stats: AdminStats | null
  driverRows: DriverRow[]
  error: string | null
  bind: () => () => void
  refresh: () => Promise<void>
  loadDrivers: () => Promise<void>
  approveDriver: (driverId: string, approved: boolean) => Promise<void>
  blockUser: (userId: string, blocked: boolean) => Promise<void>
  surge: SurgeSettings | null
  loadSettings: () => Promise<void>
  updateSurge: (patch: Partial<SurgeSettings>) => Promise<void>
  /** null — 013 qo'llanmagan */
  commissionPct: number | null
  updateCommission: (pct: number) => Promise<void>
  driverWallet: (driverId: string) => Promise<WalletDetails>
  changeBalance: (driverId: string, amount: number, note: string) => Promise<void>
  changeScore: (driverId: string, delta: number, note: string) => Promise<void>
  searchOrders: (filter: OrderSearch) => Promise<{ orders: Order[]; total: number }>
  cancelOrder: (orderId: string) => Promise<void>
  updateTariff: (id: Tariff, patch: TariffPatch) => Promise<void>
}

/** Statistikani (bugungi tushum va h.k.) vaqti-vaqti bilan serverdan yangilash */
const REFRESH_MS = 20_000

export const useAdminStore = create<AdminState>((set, get) => ({
  drivers: {},
  orders: [],
  stats: null,
  driverRows: [],
  error: null,
  surge: null,
  commissionPct: null,

  bind: () => {
    const s = getSocket()
    const onConnect = () => get().refresh()
    const onLocation = (loc: DriverLocation) =>
      set((st) => {
        // Yangi haydovchi (snapshot'da yo'q) — ismi keyingi yangilanishda keladi
        const prev: Pick<DriverMarker, 'fullName' | 'phone'> = st.drivers[loc.driverId] ?? { fullName: null, phone: null }
        return { drivers: { ...st.drivers, [loc.driverId]: { ...prev, ...loc } } }
      })
    const onOffline = (driverId: string) =>
      set((st) => {
        const drivers = { ...st.drivers }
        delete drivers[driverId]
        return { drivers }
      })
    const onOrder = (order: Order) =>
      set((st) => {
        const rest = st.orders.filter((o) => o.id !== order.id)
        return { orders: isActive(order.status) ? [order, ...rest] : rest }
      })

    s.on('connect', onConnect)
    s.on('driver:location', onLocation)
    s.on('driver:offline', onOffline)
    s.on('order:updated', onOrder)
    if (s.connected) onConnect()
    const timer = setInterval(() => s.connected && get().refresh(), REFRESH_MS)

    return () => {
      clearInterval(timer)
      s.off('connect', onConnect)
      s.off('driver:location', onLocation)
      s.off('driver:offline', onOffline)
      s.off('order:updated', onOrder)
    }
  },

  refresh: async () => {
    try {
      const snap = await request<Snapshot>('admin:snapshot', null)
      set({
        drivers: Object.fromEntries(snap.drivers.map((d) => [d.driverId, d])),
        orders: snap.orders,
        stats: snap.stats,
        error: null,
      })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  loadDrivers: async () => {
    set({ driverRows: await request<DriverRow[]>('admin:drivers', null) })
  },

  approveDriver: async (driverId, approved) => {
    set({ driverRows: await request<DriverRow[]>('admin:approve', { driverId, approved }) })
  },

  blockUser: async (userId, blocked) => {
    set({ driverRows: await request<DriverRow[]>('admin:block', { userId, blocked }) })
  },

  loadSettings: async () => {
    const r = await request<{ surge: SurgeSettings; commissionPct: number | null }>('settings:get', null)
    set({ surge: r.surge, commissionPct: r.commissionPct })
  },

  updateSurge: async (patch) => {
    const current = get().surge ?? { enabled: false, max: 2 }
    set({ surge: (await request<{ surge: SurgeSettings }>('settings:update', { surge: { ...current, ...patch } })).surge })
  },

  updateCommission: async (pct) => {
    const r = await request<{ commissionPct: number | null }>('settings:update', { commissionPct: pct })
    set({ commissionPct: r.commissionPct })
  },

  driverWallet: (driverId) => request<WalletDetails>('admin:wallet', { driverId }),

  changeBalance: async (driverId, amount, note) => {
    set({ driverRows: await request<DriverRow[]>('admin:balance', { driverId, amount, note }) })
  },

  changeScore: async (driverId, delta, note) => {
    set({ driverRows: await request<DriverRow[]>('admin:score', { driverId, delta, note }) })
  },

  searchOrders: (filter) => request<{ orders: Order[]; total: number }>('admin:orders', filter),

  cancelOrder: async (orderId) => {
    await request<Order>('order:status', { orderId, status: 'cancelled' })
  },

  updateTariff: async (id, patch) => {
    const tariffs = await request<TariffConfig[]>('tariffs:update', { id, patch })
    useTariffStore.getState().setTariffs(tariffs)
  },
}))
