import { describe, expect, it } from 'vitest'
import { normalizePhone } from './orders.service.js'

describe('normalizePhone', () => {
  it('har xil yozilishlarni bir xil ko‘rinishga keltiradi', () => {
    expect(normalizePhone('90 123 45 67')).toBe('+998901234567')
    expect(normalizePhone('901234567')).toBe('+998901234567')
    expect(normalizePhone('+998 (90) 123-45-67')).toBe('+998901234567')
    expect(normalizePhone('998901234567')).toBe('+998901234567')
  })

  it("noto'g'ri raqamlarni rad etadi", () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(901234567)).toBeNull()
  })
})
