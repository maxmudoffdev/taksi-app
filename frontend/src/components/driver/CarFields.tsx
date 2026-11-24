import { CarFront, Hash } from 'lucide-react'
import { Field } from '../ui/Field'
import { cn } from '../ui/cn'
import { CAR_COLORS, CAR_MODELS, type CarDraft } from './carOptions'

/** Mashina rusumi, rangi va davlat raqami (ro'yxatdan o'tish va profil uchun) */
export default function CarFields({ value, onChange }: { value: CarDraft; onChange: (v: CarDraft) => void }) {
  const set = (key: keyof CarDraft, v: string) => onChange({ ...value, [key]: v })
  return (
    <div className="space-y-4">
      <Field
        label="Mashina rusumi"
        icon={<CarFront />}
        list="car-models"
        placeholder="Chevrolet Cobalt"
        required
        value={value.model}
        onChange={(e) => set('model', e.target.value)}
      />
      <datalist id="car-models">
        {CAR_MODELS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <div className="text-sm">
        <span className="mb-1.5 block font-medium text-muted">Rangi</span>
        <div className="flex flex-wrap gap-1.5">
          {CAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set('color', c)}
              aria-pressed={value.color === c}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                value.color === c ? 'border-ink bg-ink text-on-ink' : 'border-line bg-surface hover:bg-subtle',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="Davlat raqami"
        icon={<Hash />}
        placeholder="01 A 123 BC"
        autoCapitalize="characters"
        required
        value={value.plate}
        onChange={(e) => set('plate', e.target.value.toUpperCase())}
        hint="Yo‘lovchi aynan shu raqam bo‘yicha mashinangizni taniydi"
      />
    </div>
  )
}
