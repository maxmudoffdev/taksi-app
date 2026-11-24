import type { ScoreZone } from '../../types'

/** Ball zonasi ranglari */
export const ZONE_STYLE: Record<ScoreZone, { dot: string; text: string; label: string }> = {
  green: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', label: 'Yashil' },
  yellow: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', label: 'Sariq' },
  red: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Qizil' },
}

