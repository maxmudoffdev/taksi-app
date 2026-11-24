import { describe, expect, it } from 'vitest'
import { CODE_TTL_MS, CodeStore, MAX_ATTEMPTS, RateLimiter, RESEND_MS } from './otp'

function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

const issueCode = (store: CodeStore, key: string) => {
  const r = store.issue(key)
  if (!('code' in r)) throw new Error('kod berilmadi')
  return r.code
}

describe('CodeStore', () => {
  it('6 xonali kod beradi va to‘g‘ri kod bir marta qabul qilinadi', () => {
    const store = new CodeStore()
    const code = issueCode(store, '+998901234567')
    expect(code).toMatch(/^\d{6}$/)
    expect(store.verify('+998901234567', code)).toEqual({ ok: true })
    expect(store.verify('+998901234567', code)).toEqual({ ok: false, reason: 'missing' })
  })

  it('boshqa raqamning kodi mos kelmaydi', () => {
    const store = new CodeStore()
    const code = issueCode(store, '+998901111111')
    issueCode(store, '+998902222222')
    expect(store.verify('+998902222222', code).ok).toBe(false)
  })

  it('60 soniya ichida qayta yubormaydi', () => {
    const c = clock()
    const store = new CodeStore(c.now)
    issueCode(store, 'k')
    c.advance(20_000)
    expect(store.issue('k')).toEqual({ retryInMs: RESEND_MS - 20_000 })
    c.advance(RESEND_MS)
    expect('code' in store.issue('k')).toBe(true)
  })

  it('muddati o‘tgan kod rad etiladi', () => {
    const c = clock()
    const store = new CodeStore(c.now)
    const code = issueCode(store, 'k')
    c.advance(CODE_TTL_MS + 1)
    expect(store.verify('k', code)).toEqual({ ok: false, reason: 'expired' })
  })

  it(`${MAX_ATTEMPTS} marta xatodan keyin to‘g‘ri kod ham qabul qilinmaydi`, () => {
    const store = new CodeStore()
    const code = issueCode(store, 'k')
    const wrong = code === '000000' ? '111111' : '000000'
    expect(store.verify('k', wrong)).toEqual({ ok: false, reason: 'wrong', attemptsLeft: MAX_ATTEMPTS - 1 })
    for (let i = 1; i < MAX_ATTEMPTS - 1; i++) store.verify('k', wrong)
    expect(store.verify('k', wrong)).toEqual({ ok: false, reason: 'locked' })
    expect(store.verify('k', code)).toEqual({ ok: false, reason: 'locked' })
  })
})

describe('RateLimiter', () => {
  it('oyna ichida limitdan oshganini to‘xtatadi', () => {
    const c = clock()
    const rl = new RateLimiter(2, 1000, c.now)
    expect(rl.allow('ip')).toBe(true)
    expect(rl.allow('ip')).toBe(true)
    expect(rl.allow('ip')).toBe(false)
    expect(rl.allow('boshqa')).toBe(true)
    c.advance(1001)
    expect(rl.allow('ip')).toBe(true)
  })
})
