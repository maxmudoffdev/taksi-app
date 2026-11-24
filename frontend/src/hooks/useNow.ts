import { useEffect, useState } from 'react'

/** Har `intervalMs` da yangilanadigan joriy vaqt (taymerlar uchun) */
export function useNow(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])
  return now
}
