import { create } from 'zustand'
import { DEFAULT_TARIFFS, type TariffConfig } from '../services/pricing'
import type { Tariff } from '../types'

type TariffState = {
  /** Serverdan kelguncha — standart tariflar */
  tariffs: TariffConfig[]
  setTariffs: (tariffs: TariffConfig[]) => void
}

export const useTariffStore = create<TariffState>((set) => ({
  tariffs: DEFAULT_TARIFFS,
  setTariffs: (tariffs) => set({ tariffs: tariffs.length ? tariffs : DEFAULT_TARIFFS }),
}))

export const useTariffs = () => useTariffStore((s) => s.tariffs)

export function useTariff(id: Tariff): TariffConfig | undefined {
  return useTariffStore((s) => s.tariffs.find((t) => t.id === id))
}
