/**
 * O'zbekcha sana formatlari. Brauzerlarda "uz-UZ" oy nomlari ko'pincha yo'q ("M11" chiqadi),
 * shuning uchun nomlar shu yerda.
 */
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek']
const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']

const pad = (n: number) => String(n).padStart(2, '0')
const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v))

/** "09:07" */
export function formatTime(v: string | Date): string {
  const d = toDate(v)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "24-noy, 09:07" */
export function formatShortDateTime(v: string | Date): string {
  const d = toDate(v)
  return `${d.getDate()}-${MONTHS_SHORT[d.getMonth()]}, ${formatTime(d)}`
}

/** "23-noyabr, yakshanba" */
export function formatLongDay(v: string | Date): string {
  const d = toDate(v)
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`
}
