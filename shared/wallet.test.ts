import { describe, expect, it } from 'vitest'
import { clampScore, commissionFor, dispatchBlock, scoreZone } from './wallet'

describe('commissionFor', () => {
  it('10% va 100 so‘mgacha yaxlitlash', () => {
    expect(commissionFor(30_000, 10)).toBe(3_000)
    expect(commissionFor(23_400, 10)).toBe(2_300)
    expect(commissionFor(23_500, 10)).toBe(2_400)
    expect(commissionFor(18_000, 15)).toBe(2_700)
  })
  it('noto‘g‘ri qiymatlarda 0', () => {
    expect(commissionFor(0, 10)).toBe(0)
    expect(commissionFor(10_000, 0)).toBe(0)
    expect(commissionFor(Number.NaN, 10)).toBe(0)
  })
})

describe('scoreZone', () => {
  it('chegaralar', () => {
    expect(scoreZone(100)).toBe('green')
    expect(scoreZone(70)).toBe('green')
    expect(scoreZone(69)).toBe('yellow')
    expect(scoreZone(40)).toBe('yellow')
    expect(scoreZone(39)).toBe('red')
    expect(scoreZone(0)).toBe('red')
  })
  it('clampScore 0–100', () => {
    expect(clampScore(105)).toBe(100)
    expect(clampScore(-3)).toBe(0)
  })
})

describe('dispatchBlock', () => {
  const now = Date.parse('2026-11-23T10:00:00Z')
  it('balans 0 — ruxsat, manfiy — yo‘q', () => {
    expect(dispatchBlock({ balance: 0, redUntil: null }, now)).toBeNull()
    expect(dispatchBlock({ balance: -500, redUntil: null }, now)).toEqual({ reason: 'balance', balance: -500 })
  })
  it('qizil pauza faqat tugaguncha', () => {
    expect(dispatchBlock({ balance: 1000, redUntil: '2026-11-23T10:30:00Z' }, now)).toEqual({ reason: 'red', until: '2026-11-23T10:30:00Z' })
    expect(dispatchBlock({ balance: 1000, redUntil: '2026-11-23T09:59:00Z' }, now)).toBeNull()
  })
})
