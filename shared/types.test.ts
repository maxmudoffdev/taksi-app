import { describe, expect, it } from 'vitest'
import { formatPlate, isValidPlate, normalizePlate } from './types'

describe('davlat raqami', () => {
  it('yagona ko‘rinishga keltiriladi', () => {
    expect(normalizePlate(' 01 a 123-bc ')).toBe('01A123BC')
  })
  it('chiroyli formatlanadi', () => {
    expect(formatPlate('01A123BC')).toBe('01 A 123 BC')
    expect(formatPlate('01123ABC')).toBe('01 123 ABC')
    expect(formatPlate('XYZ')).toBe('XYZ')
  })
  it('noto‘g‘ri raqam rad etiladi', () => {
    expect(isValidPlate('01 A 123 BC')).toBe(true)
    expect(isValidPlate('10 777 AAA')).toBe(true)
    expect(isValidPlate('ABC')).toBe(false)
    expect(isValidPlate('01A12BC')).toBe(false)
  })
})
