import { Loader2, MapPin, X } from 'lucide-react'
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { usePlaceSearch } from '../../hooks/usePlaceSearch'
import type { Place } from '../../services/geocoding'
import { cn } from '../ui/cn'

type Props = {
  marker: 'A' | 'B'
  placeholder: string
  value: Place | null
  /** Manzil aniqlanmoqda (xaritada bosilgandan keyin) */
  resolving?: boolean
  disabled?: boolean
  onSelect: (place: Place) => void
  onClear: () => void
  /** O'ng tomondagi qo'shimcha tugma (masalan, "Mening joylashuvim") */
  action?: ReactNode
}

/** Manzil qatori — RouteInputs ichida guruhlanadi; yozganda takliflar ochiladi */
export default function AddressInput({ marker, placeholder, value, resolving, disabled, onSelect, onClear, action }: Props) {
  const listId = useId()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const { results, loading, error, tooShort } = usePlaceSearch(text, editing)

  const shownText = editing ? text : resolving ? 'Manzil aniqlanmoqda…' : (value?.label ?? '')
  const open = editing && text.trim().length > 0

  const choose = (place: Place) => {
    onSelect(place)
    setEditing(false)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && results[highlight]) {
      e.preventDefault()
      choose(results[highlight])
    } else if (e.key === 'Escape') {
      setEditing(false)
      setText('')
    }
  }

  return (
    <div className="relative">
      <div className="flex min-h-14 items-center gap-3 px-3">
        <span
          className={cn(
            'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ring-4 ring-surface',
            marker === 'A' ? 'bg-ink text-on-ink' : 'bg-red-500 text-white',
          )}
        >
          {marker}
        </span>
        <div className="min-w-0 flex-1 py-2">
          <input
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="w-full truncate bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-muted"
            placeholder={placeholder}
            value={shownText}
            disabled={disabled}
            onFocus={() => {
              setEditing(true)
              setText('')
              setHighlight(0)
            }}
            onBlur={() => setTimeout(() => setEditing(false), 150)}
            onChange={(e) => {
              setText(e.target.value)
              setHighlight(0)
            }}
            onKeyDown={onKeyDown}
          />
          {!editing && value?.sublabel && <p className="truncate text-xs text-muted">{value.sublabel}</p>}
        </div>
        {resolving && <Loader2 className="size-4 animate-spin text-muted" />}
        {value && !editing && !disabled && !resolving && (
          <button type="button" onClick={onClear} className="rounded-full p-1.5 text-muted hover:bg-subtle hover:text-fg" aria-label="Tozalash">
            <X className="size-4" />
          </button>
        )}
        {action}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="scroll-thin absolute inset-x-0 top-full z-[1600] mt-1 max-h-80 animate-toast-in overflow-y-auto rounded-3xl border border-line bg-surface p-1.5 shadow-float"
        >
          {tooShort && <li className="px-4 py-3 text-sm text-muted">Kamida 3 ta harf yozing…</li>}
          {loading && (
            <li className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Qidirilmoqda…
            </li>
          )}
          {error && <li className="px-4 py-3 text-sm text-red-600">{error}</li>}
          {!loading && !tooShort && !error && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted">Hech narsa topilmadi. Xaritada bosib tanlang.</li>
          )}
          {results.map((p, i) => (
            <li key={`${p.lat},${p.lng}`} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(p)}
                onMouseEnter={() => setHighlight(i)}
                className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left', i === highlight && 'bg-subtle')}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-muted">
                  <MapPin className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.label}</span>
                  {p.sublabel && <span className="block truncate text-xs text-muted">{p.sublabel}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A va B qatorlari bitta kartochkada, orasida yo'l chizig'i */
export function RouteInputs({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-3xl bg-subtle">
      <span className="pointer-events-none absolute top-9 bottom-9 left-[23px] w-0.5 bg-[repeating-linear-gradient(to_bottom,var(--color-muted)_0_4px,transparent_4px_8px)] opacity-40" />
      <div className="divide-y divide-line">{children}</div>
    </div>
  )
}
