import { describe, expect, it } from 'vitest'
import { canTransition, isActive } from './orderStatus'

describe('buyurtma statuslari', () => {
  it("to'g'ri ketma-ketlik: created → accepted → arrived → in_trip → completed", () => {
    expect(canTransition('created', 'accepted', 'driver')).toBe(true)
    expect(canTransition('accepted', 'arrived', 'driver')).toBe(true)
    expect(canTransition('arrived', 'in_trip', 'driver')).toBe(true)
    expect(canTransition('in_trip', 'completed', 'driver')).toBe(true)
  })

  it("bosqichlarni sakrab o'tib bo'lmaydi", () => {
    expect(canTransition('created', 'in_trip', 'driver')).toBe(false)
    expect(canTransition('accepted', 'completed', 'driver')).toBe(false)
  })

  it("yo'lovchi buyurtmani qabul qila olmaydi, lekin bekor qila oladi", () => {
    expect(canTransition('created', 'accepted', 'passenger')).toBe(false)
    expect(canTransition('created', 'cancelled', 'passenger')).toBe(true)
  })

  it('safar boshlangach bekor qilib bo‘lmaydi', () => {
    expect(canTransition('in_trip', 'cancelled', 'passenger')).toBe(false)
  })

  it('dispetcher bekor qila oladi, lekin haydovchi ishini qila olmaydi', () => {
    expect(canTransition('created', 'cancelled', 'dispatcher')).toBe(true)
    expect(canTransition('created', 'accepted', 'dispatcher')).toBe(false)
    expect(canTransition('accepted', 'arrived', 'dispatcher')).toBe(false)
  })

  it('yakunlangan buyurtma o‘zgarmaydi', () => {
    expect(canTransition('completed', 'cancelled', 'admin')).toBe(false)
    expect(isActive('completed')).toBe(false)
    expect(isActive('arrived')).toBe(true)
  })
})
