/** Klass nomlarini birlashtirish (false/undefined tashlab yuboriladi) */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
