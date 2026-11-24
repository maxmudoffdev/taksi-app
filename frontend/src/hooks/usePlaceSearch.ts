import { useEffect, useState } from 'react'
import { searchPlaces, type Place } from '../services/geocoding'

const DEBOUNCE_MS = 450
const MIN_CHARS = 3

/** Yozish to'xtagach qidiradi; eski so'rovlar bekor qilinadi */
export function usePlaceSearch(query: string, enabled: boolean) {
  const [state, setState] = useState<{ query: string; results: Place[]; error: string | null } | null>(null)
  const q = query.trim()
  const active = enabled && q.length >= MIN_CHARS

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(q, controller.signal)
        .then((results) => setState({ query: q, results, error: null }))
        .catch((e: Error) => {
          if (e.name !== 'AbortError') setState({ query: q, results: [], error: e.message })
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q, active])

  const current = active && state?.query === q ? state : null
  return {
    results: current?.results ?? [],
    error: current?.error ?? null,
    loading: active && !current,
    tooShort: enabled && q.length > 0 && q.length < MIN_CHARS,
  }
}
