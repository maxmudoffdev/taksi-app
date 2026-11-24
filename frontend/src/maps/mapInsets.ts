import { createContext, useContext } from 'react'
import type { MapInsets } from './RouteMap'

/** Xarita ustidagi panellar egallagan joy — MapShell o'lchab beradi, RouteMap o'qiydi */
export const MapInsetsContext = createContext<MapInsets | undefined>(undefined)
export const useMapInsetsContext = () => useContext(MapInsetsContext)
