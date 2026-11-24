import type { OrderStatus, UserRole } from './types'

/** Qaysi statusdan qaysiga, kim o'tkaza oladi */
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, UserRole[]>>> = {
  created: { accepted: ['driver'], cancelled: ['passenger', 'admin', 'dispatcher'] },
  accepted: { arrived: ['driver'], cancelled: ['passenger', 'driver', 'admin', 'dispatcher'] },
  arrived: { in_trip: ['driver'], cancelled: ['passenger', 'driver', 'admin', 'dispatcher'] },
  in_trip: { completed: ['driver', 'admin', 'dispatcher'] },
  completed: {},
  cancelled: {},
}

export const ACTIVE_STATUSES: OrderStatus[] = ['created', 'accepted', 'arrived', 'in_trip']

export function canTransition(from: OrderStatus, to: OrderStatus, role: UserRole): boolean {
  return TRANSITIONS[from][to]?.includes(role) ?? false
}

export function isActive(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status)
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  created: 'Haydovchi qidirilmoqda',
  accepted: 'Haydovchi yo‘lda',
  arrived: 'Haydovchi yetib keldi',
  in_trip: 'Safarda',
  completed: 'Safar yakunlandi',
  cancelled: 'Bekor qilindi',
}
