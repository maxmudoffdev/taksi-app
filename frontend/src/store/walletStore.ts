import { create } from 'zustand'
import { getSocket, request } from '../services/socket'
import type { DriverStanding, ScoreEvent, WalletTx } from '../types'
import { playAlert } from '../utils/sound'
import { useDriverStore } from './driverStore'
import { useOrderStore } from './orderStore'

export type Standing = DriverStanding & { blockMessage: string | null }
export type WalletDetails = { standing: DriverStanding; blockMessage: string | null; transactions: WalletTx[]; scoreEvents: ScoreEvent[] }

type WalletState = {
  standing: Standing | null
  details: WalletDetails | null
  loading: boolean
  error: string | null
  setStanding: (s: Standing | null) => void
  loadDetails: () => Promise<void>
  bind: () => () => void
}

/** Haydovchi balansi va bali: serverdan `wallet:updated` bilan jonli yangilanadi */
export const useWalletStore = create<WalletState>((set, get) => ({
  standing: null,
  details: null,
  loading: false,
  error: null,

  setStanding: (next) => {
    const prev = get().standing
    set({ standing: next })
    if (!next || !prev) return
    // Bloklanish holati o'zgardi
    if (next.blockMessage && !prev.blockMessage) {
      useOrderStore.getState().notify(`⛔ ${next.blockMessage}`, 'warning')
      useDriverStore.setState({ openOrders: [] })
      playAlert(1)
    } else if (!next.blockMessage && prev.blockMessage) {
      useOrderStore.getState().notify('✅ Buyurtmalar yana keladi', 'success')
      // Ochiq buyurtmalar ro'yxatini qayta olish
      const driver = useDriverStore.getState()
      if (driver.wantsOnline) void driver.setOnline(true)
    } else if (next.zone !== prev.zone) {
      const text = { green: '🟢 Ballingiz yashil zonada — buyurtmalar darhol keladi', yellow: '🟡 Ballingiz sariq zonaga tushdi — buyurtmalar 15 soniya kechikib keladi', red: '🔴 Ballingiz qizil zonada' }[next.zone]
      useOrderStore.getState().notify(text, next.zone === 'green' ? 'success' : 'warning')
    }
  },

  loadDetails: async () => {
    set({ loading: true, error: null })
    try {
      const details = await request<WalletDetails>('driver:wallet', null)
      set({ details, standing: { ...details.standing, blockMessage: details.blockMessage }, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) })
    }
  },

  bind: () => {
    const s = getSocket()
    const onUpdate = (st: Standing) => {
      get().setStanding(st)
      // Tarix sahifasi ochiq bo'lsa — ro'yxat ham yangilansin
      if (get().details) void get().loadDetails()
    }
    const onNotice = (text: string) => useOrderStore.getState().notify(text, 'success')
    s.on('wallet:updated', onUpdate)
    s.on('notice', onNotice)
    return () => {
      s.off('wallet:updated', onUpdate)
      s.off('notice', onNotice)
    }
  },
}))
