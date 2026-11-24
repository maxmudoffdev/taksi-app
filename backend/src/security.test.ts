import { describe, expect, it } from 'vitest'
import { checkEvent, looksLikeValidJwt } from './security'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (payload: object) => `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`
const URL = 'https://abc.supabase.co'

describe('looksLikeValidJwt', () => {
  const exp = Math.floor(Date.now() / 1000) + 3600
  it('to‘g‘ri ko‘rinishdagi token', () => {
    expect(looksLikeValidJwt(jwt({ exp, sub: 'u1', iss: `${URL}/auth/v1` }), URL)).toBe(true)
  })
  it('axlat, muddati o‘tgan, boshqa loyiha — rad etiladi', () => {
    expect(looksLikeValidJwt('abc', URL)).toBe(false)
    expect(looksLikeValidJwt('a.b.c', URL)).toBe(false)
    expect(looksLikeValidJwt(jwt({ exp: 1, sub: 'u1', iss: `${URL}/auth/v1` }), URL)).toBe(false)
    expect(looksLikeValidJwt(jwt({ exp, sub: 'u1', iss: 'https://evil.supabase.co/auth/v1' }), URL)).toBe(false)
    expect(looksLikeValidJwt(jwt({ exp, iss: `${URL}/auth/v1` }), URL)).toBe(false)
    expect(looksLikeValidJwt('x'.repeat(5000), URL)).toBe(false)
  })
})

describe('checkEvent', () => {
  it('og‘ir so‘rovlar tezroq cheklanadi, GPS umumiy hisobga kirmaydi', () => {
    const verdicts = Array.from({ length: 20 }, () => checkEvent('heavy-user', 'history:list'))
    expect(verdicts.slice(0, 15).every((v) => v === 'ok')).toBe(true)
    expect(verdicts[15]).toBe('limited')
    const gps = Array.from({ length: 60 }, () => checkEvent('gps-user', 'driver:location'))
    expect(gps.every((v) => v === 'ok')).toBe(true)
  })
  it('juda ko‘p so‘rov — ulanish uziladi', () => {
    const v = Array.from({ length: 160 }, () => checkEvent('spammer', 'order:status'))
    expect(v.includes('limited')).toBe(true)
    expect(v[v.length - 1]).toBe('abuse')
  })
})
