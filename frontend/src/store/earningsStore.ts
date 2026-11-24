import { create } from 'zustand'
import { request } from '../services/socket'

export type EarningsPeriod = { trips: number; amount: number }
export type DriverSummary = {
  today: EarningsPeriod
  week: EarningsPeriod
  month: EarningsPeriod
  rating: number | null
  ratingCount: number
}

type EarningsState = {
  summary: DriverSummary | null
  load: () => Promise<void>
}

/** Haydovchi daromadi (bugun / hafta / oy) va reytingi */
export const useEarningsStore = create<EarningsState>((set) => ({
  summary: null,
  load: async () => {
    try {
      set({ summary: await request<DriverSummary>('driver:summary', null) })
    } catch {
      /* ko'rsatmasak ham bo'ladi */
    }
  },
}))
