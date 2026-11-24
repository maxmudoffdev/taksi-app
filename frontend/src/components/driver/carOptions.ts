/** O'zbekistonda eng ko'p uchraydigan taksi mashinalari (tez tanlash uchun) */
export const CAR_MODELS = [
  'Chevrolet Cobalt',
  'Chevrolet Nexia 3',
  'Chevrolet Gentra',
  'Chevrolet Lacetti',
  'Chevrolet Spark',
  'Chevrolet Onix',
  'Chevrolet Malibu',
  'Chevrolet Tracker',
  'Chevrolet Damas',
  'Daewoo Nexia',
  'Kia K5',
  'Hyundai Elantra',
  'BYD Chazor',
]

export const CAR_COLORS = ['Oq', 'Qora', 'Kulrang', 'Kumush', 'Ko‘k', 'Qizil', 'Yashil', 'Sariq'] as const

export type CarDraft = { model: string; color: string; plate: string }
export const EMPTY_CAR: CarDraft = { model: '', color: '', plate: '' }
