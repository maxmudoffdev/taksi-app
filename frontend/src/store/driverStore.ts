import { create } from 'zustand'
import { getSocket, request } from '../services/socket'
import type { DriverStanding, LatLng, Order } from '../types'
import { startRinging, stopRinging } from '../utils/sound'
import { systemNotify, useOrderStore } from './orderStore'
import { useWalletStore } from './walletStore'

const ONLINE_KEY = 'taksi:driver-online'

function readOnlinePreference(): boolean {
  try {
    return localStorage.getItem(ONLINE_KEY) === '1'
  } catch {
    return false
  }
}

function saveOnlinePreference(online: boolean) {
  try {
    localStorage.setItem(ONLINE_KEY, online ? '1' : '0')
  } catch {
    /* saqlab bo'lmasa — muhim emas */
  }
}

type DriverState = {
  online: boolean
  /** Foydalanuvchi onlayn bo'lishni xohlaydi (qayta ulanganda tiklanadi) */
  wantsOnline: boolean
  openOrders: Order[]
  error: string | null
  bind: () => () => void
  setOnline: (online: boolean) => Promise<void>
  sendLocation: (loc: LatLng & { heading: number | null }) => void
}

export const useDriverStore = create<DriverState>((set, get) => {
  const goOnline = async (online: boolean) => {
    try {
      const res = await request<{ openOrders: Order[]; standing?: DriverStanding; blockMessage?: string | null }>('driver:online', { online })
      set({ online, openOrders: res.openOrders, error: null })
      // Balans/ball tizimi yoqilgan bo'lsa — holat ham keladi
      if (res.standing) useWalletStore.getState().setStanding({ ...res.standing, blockMessage: res.blockMessage ?? null })
    } catch (e) {
      set({ online: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return {
    online: false,
    wantsOnline: readOnlinePreference(),
    openOrders: [],
    error: null,

    /** Haydovchi sahifasi ochilganda socket hodisalariga ulanish */
    bind: () => {
      const s = getSocket()
      const onConnect = () => {
        if (get().wantsOnline) goOnline(true)
      }
      const onDisconnect = () => set({ online: false })
      const onNew = (order: Order) => {
        if (!get().online) return
        set((st) => ({ openOrders: [...st.openOrders.filter((o) => o.id !== order.id), order] }))
        useOrderStore.getState().notify('🔔 Yangi buyurtma!', 'info')
        systemNotify(`🔔 Yangi buyurtma${order.pickupAddress ? `: ${order.pickupAddress}` : ''}`)
        startRinging()
      }
      const onTaken = (orderId: string) => {
        set((st) => ({ openOrders: st.openOrders.filter((o) => o.id !== orderId) }))
        if (!get().openOrders.length) stopRinging()
      }

      s.on('connect', onConnect)
      s.on('disconnect', onDisconnect)
      s.on('order:new', onNew)
      s.on('order:taken', onTaken)
      if (s.connected) onConnect()

      return () => {
        s.off('connect', onConnect)
        s.off('disconnect', onDisconnect)
        s.off('order:new', onNew)
        s.off('order:taken', onTaken)
      }
    },

    setOnline: async (online) => {
      // Tugma bosilgan payt — fon bildirishnomalari uchun ruxsat so'raymiz (bir marta)
      if (online && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }
      if (!online) stopRinging()
      set({ wantsOnline: online })
      saveOnlinePreference(online)
      await goOnline(online)
      if (!online) set({ openOrders: [] })
    },

    sendLocation: (loc) => {
      const s = getSocket()
      if (s.connected) s.emit('driver:location', loc)
    },
  }
})
