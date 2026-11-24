/**
 * O'zbekiston mobil raqamini yagona ko'rinishga keltirish (backend bilan bir xil qoida):
 *   "90 123 45 67" / "901234567" / "+998 90 123-45-67" → "+998901234567"
 * Noto'g'ri bo'lsa — null.
 */
export function normalizeUzPhone(v: string): string | null {
  const d = v.replace(/\D/g, '')
  if (d.length === 9) return `+998${d}`
  if (d.length === 12 && d.startsWith('998')) return `+${d}`
  return null
}
