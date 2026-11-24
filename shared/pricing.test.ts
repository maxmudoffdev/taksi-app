import { describe, expect, it } from 'vitest'
import {
  applySurge,
  calculatePrice,
  surgeMultiplier,
  DEFAULT_TARIFFS,
  formatSum,
  minutesBetween,
  validateTariffPatch,
  waitingFeeFor,
  type TariffConfig,
} from './pricing'

const tariff = (id: string) => DEFAULT_TARIFFS.find((t) => t.id === id) as TariffConfig

describe('calculatePrice', () => {
  it('Ekonom: 5.4 km, 12 daqiqa', () => {
    // 5000 + 1800*5.4 (9720) + 300*12 (3600) = 18320 → 18500
    const p = calculatePrice(tariff('economy'), 5.4, 12)
    expect(p.distance).toBe(9720)
    expect(p.time).toBe(3600)
    expect(p.total).toBe(18500)
    expect(p.minFareTopUp).toBe(0)
  })

  it('Komfort: 5.4 km, 12 daqiqa', () => {
    // 8000 + 2500*5.4 (13500) + 400*12 (4800) = 26300 → 26500
    expect(calculatePrice(tariff('comfort'), 5.4, 12).total).toBe(26500)
  })

  it('Yetkazib berish: 5.4 km, 12 daqiqa', () => {
    // 7000 + 2000*5.4 (10800) + 200*12 (2400) = 20200 → 20500
    expect(calculatePrice(tariff('delivery'), 5.4, 12).total).toBe(20500)
  })

  it("qisqa yo'lda eng kam narx qo'llanadi", () => {
    // 5000 + 1800*0.5 (900) + 300*1 (300) = 6200 → 6500 → min 9000
    const p = calculatePrice(tariff('economy'), 0.5, 1)
    expect(p.total).toBe(9000)
    expect(p.minFareTopUp).toBe(2500)
  })

  it('500 so‘mga yuqoriga yaxlitlaydi', () => {
    // 5000 + 1800*10 + 300*20 = 29000 — aniq, yaxlitlash kerak emas
    expect(calculatePrice(tariff('economy'), 10, 20).total).toBe(29000)
    // 29000 + 1800*0.1 = 29180 → 29500
    expect(calculatePrice(tariff('economy'), 10.1, 20).total).toBe(29500)
  })

  it('Komfort har doim Ekonomdan qimmat', () => {
    for (const [km, min] of [[1, 3], [5, 12], [25, 40]]) {
      expect(calculatePrice(tariff('comfort'), km, min).total).toBeGreaterThan(calculatePrice(tariff('economy'), km, min).total)
    }
  })

  it("noto'g'ri qiymatlarda xato beradi", () => {
    expect(() => calculatePrice(tariff('economy'), -1, 5)).toThrow(RangeError)
    expect(() => calculatePrice(tariff('economy'), NaN, 5)).toThrow(RangeError)
  })
})

describe('kutish haqi', () => {
  it('bepul vaqt ichida kutish tekin', () => {
    const p = calculatePrice(tariff('economy'), 5.4, 12, 3)
    expect(p.waiting).toBe(0)
    expect(p.total).toBe(18500)
  })

  it('bepul vaqtdan keyingi har daqiqa hisoblanadi', () => {
    // Ekonom: 3 daq bepul, 7 daq kutdi → 4 × 500 = 2000
    const p = calculatePrice(tariff('economy'), 5.4, 12, 7)
    expect(p.paidWaitMin).toBe(4)
    expect(p.waiting).toBe(2000)
    expect(p.total).toBe(20500)
  })

  it("boshlangan daqiqa to'liq hisoblanadi", () => {
    // 3.2 daq → 0.2 daq pullik → 1 daqiqa
    expect(calculatePrice(tariff('economy'), 5.4, 12, 3.2).waiting).toBe(500)
  })

  it("kutish haqi eng kam narx ustiga qo'shiladi", () => {
    // qisqa yo'l → 9000 (min), + 5 daq kutish (2 pullik × 500)
    expect(calculatePrice(tariff('economy'), 0.5, 1, 5).total).toBe(10000)
  })

  it('Komfortda bepul kutish uzunroq', () => {
    // 5 daq bepul, 8 daq → 3 × 700 = 2100
    expect(calculatePrice(tariff('comfort'), 5.4, 12, 8).waiting).toBe(2100)
  })

  it('pullik kutish chegaradan oshmaydi', () => {
    // Ekonom: 3 bepul + 15 pullik chegara; 9 soat kutsa ham 15 × 500 = 7500
    const p = calculatePrice(tariff('economy'), 5.4, 12, 526)
    expect(p.paidWaitMin).toBe(15)
    expect(p.waiting).toBe(7500)
  })

  it("manfiy kutish xato beradi", () => {
    expect(() => calculatePrice(tariff('economy'), 5, 10, -1)).toThrow(RangeError)
  })
})

describe('kutish vaqtidan haq', () => {
  it('arrived → in_trip oralig‘idan hisoblanadi', () => {
    const min = minutesBetween('2026-01-01T10:00:00Z', '2026-01-01T10:06:30Z')
    expect(min).toBe(6.5)
    // Ekonom: 3 daq bepul → 3.5 daq → 4 pullik daqiqa × 500
    expect(waitingFeeFor(tariff('economy'), min)).toBe(2000)
  })

  it('tez chiqqan yo‘lovchidan kutish olinmaydi', () => {
    expect(waitingFeeFor(tariff('economy'), minutesBetween('2026-01-01T10:00:00Z', '2026-01-01T10:02:00Z'))).toBe(0)
  })
})

describe('formatSum', () => {
  it("so'mni chiroyli formatlaydi", () => {
    expect(formatSum(18500)).toBe("18 500 so'm")
    expect(formatSum(9000)).toBe("9 000 so'm")
    expect(formatSum(125000)).toBe("125 000 so'm")
  })
})

describe('validateTariffPatch', () => {
  it("to'g'ri qiymatlarni qabul qiladi", () => {
    expect(validateTariffPatch({ perKm: 2000, name: ' Ekonom+ ' })).toEqual({ ok: true, value: { perKm: 2000, name: 'Ekonom+' } })
  })

  it('manfiy, kasr va juda katta sonlarni rad etadi', () => {
    expect(validateTariffPatch({ perKm: -1 }).ok).toBe(false)
    expect(validateTariffPatch({ perKm: 1.5 }).ok).toBe(false)
    expect(validateTariffPatch({ baseFare: 5_000_000 }).ok).toBe(false)
    expect(validateTariffPatch({ perKm: '2000' }).ok).toBe(false)
  })

  it("noma'lum maydonlarni e'tiborsiz qoldiradi, bo'sh o'zgarishni rad etadi", () => {
    expect(validateTariffPatch({ id: 'comfort' }).ok).toBe(false)
    expect(validateTariffPatch({ name: '   ' }).ok).toBe(false)
  })
})

describe('yuqori talab (surge)', () => {
  it('talab taklifdan oshmasa narx o‘zgarmaydi', () => {
    expect(surgeMultiplier(1, 0, 2)).toBe(1) // bitta buyurtma, haydovchi yo'q
    expect(surgeMultiplier(3, 3, 2)).toBe(1)
    expect(surgeMultiplier(0, 0, 2)).toBe(1)
  })

  it('nisbat oshgani sari koeffitsiyent bosqichma-bosqich oshadi', () => {
    expect(surgeMultiplier(3, 2, 3)).toBe(1.2) // 1.5
    expect(surgeMultiplier(4, 2, 3)).toBe(1.4) // 2
    expect(surgeMultiplier(6, 2, 3)).toBe(1.7) // 3
    expect(surgeMultiplier(10, 1, 3)).toBe(2)
  })

  it('admin belgilagan chegaradan oshmaydi', () => {
    expect(surgeMultiplier(10, 1, 1.5)).toBe(1.5)
    expect(surgeMultiplier(10, 1, 1)).toBe(1)
  })

  it('faqat safar narxiga qo‘llanadi, 500 ga yaxlitlanadi', () => {
    expect(applySurge(18500, 1)).toBe(18500)
    expect(applySurge(18500, 1.4)).toBe(26000) // 25 900 → 26 000
    const p = calculatePrice(tariff('economy'), 5, 12, 10, 1.4)
    const plain = calculatePrice(tariff('economy'), 5, 12, 10)
    expect(p.waiting).toBe(plain.waiting)
    expect(p.total).toBe(applySurge(plain.total - plain.waiting, 1.4) + plain.waiting)
    expect(p.surgeAmount).toBe(p.total - plain.total)
  })

  it('1 dan kichik koeffitsiyent rad etiladi', () => {
    expect(() => calculatePrice(tariff('economy'), 5, 12, 0, 0.5)).toThrow(RangeError)
  })
})
