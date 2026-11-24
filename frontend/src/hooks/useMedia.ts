import { useSyncExternalStore } from 'react'

/** CSS media query holati (masalan, '(min-width: 1024px)') */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const useIsDesktop = () => useMedia('(min-width: 1024px)')
export const useDarkMode = () => useMedia('(prefers-color-scheme: dark)')
