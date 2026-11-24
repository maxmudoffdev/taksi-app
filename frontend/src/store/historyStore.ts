import { create } from 'zustand'
import { request } from '../services/socket'
import type { Order } from '../types'

type HistoryState = {
  orders: Order[]
  hasMore: boolean
  loading: boolean
  error: string | null
  /** Birinchi sahifa (yangidan) */
  reload: () => Promise<void>
  loadMore: () => Promise<void>
  /** Baho qo'yilgandan keyin ro'yxatdagi buyurtmani yangilash */
  replace: (order: Order) => void
}

export const useHistoryStore = create<HistoryState>((set, get) => {
  const fetchPage = async (before?: string) => {
    set({ loading: true, error: null })
    try {
      const res = await request<{ orders: Order[]; hasMore: boolean }>('history:list', { before })
      set((s) => ({ orders: before ? [...s.orders, ...res.orders] : res.orders, hasMore: res.hasMore }))
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ loading: false })
    }
  }
  return {
    orders: [],
    hasMore: false,
    loading: false,
    error: null,
    reload: () => fetchPage(),
    loadMore: async () => {
      const last = get().orders.at(-1)
      if (last && !get().loading) await fetchPage(last.createdAt)
    },
    replace: (order) => set((s) => ({ orders: s.orders.map((o) => (o.id === order.id ? order : o)) })),
  }
})
