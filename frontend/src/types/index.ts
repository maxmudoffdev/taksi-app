import type { UserRole } from '../../../shared/types'

export type { CancelReason, CarInfo, DriverLocation, LatLng, Order, OrderStatus, RouteInfo, Tariff, UserRole } from '../../../shared/types'
export { formatPlate, isValidPlate, normalizePlate } from '../../../shared/types'

export interface AppUser {
  id: string
  full_name: string | null
  phone: string | null
  role: UserRole
  is_approved: boolean
  created_at: string
  /** 011_features.sql dan keyin */
  is_blocked?: boolean
  car_model?: string | null
  car_color?: string | null
  car_plate?: string | null
}
export type { DriverStanding, ScoreEvent, ScoreReason, ScoreZone, TxKind, WalletTx } from '../../../shared/wallet'
