import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useIsDesktop } from '../../hooks/useMedia'
import { MapInsetsContext } from '../../maps/mapInsets'
import type { MapInsets } from '../../maps/RouteMap'
import Notices from '../Notices'
import { cn } from '../ui/cn'
import Logo from '../ui/Logo'
import UserMenu from './UserMenu'

/** Panel o'lchamini kuzatib, xarita uchun "band" joylarni hisoblaydi */
function usePanelInsets(): [React.RefObject<HTMLElement | null>, MapInsets] {
  const ref = useRef<HTMLElement>(null)
  const desktop = useIsDesktop()
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.target.getBoundingClientRect()
      // Mayda o'zgarishlarda xaritani qayta surmaslik uchun 24px qadam
      setSize({ w: Math.round(r.width / 24) * 24, h: Math.round(r.height / 24) * 24 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const insets: MapInsets = desktop ? { left: size.w + 16, top: 72 } : { top: 72, bottom: size.h }
  return [ref, insets]
}

type Props = {
  /** To'liq ekranli xarita */
  map: ReactNode
  /** Pastki (mobil) / chap (desktop) panel tarkibi */
  children: ReactNode
  /** Xarita ustida, tepada qo'shimcha element (masalan, onlayn holati) */
  topCenter?: ReactNode
  /** Xarita ustidagi suzuvchi tugmalar (o'ngda) */
  mapActions?: ReactNode
}

/**
 * Taksi ilovasi uslubidagi sahifa: xarita butun ekran, ustida suzuvchi panel.
 * Mobil — pastdan chiquvchi "sheet", desktop — chapda suzuvchi kartochka.
 */
export default function MapShell({ map, children, topCenter, mapActions }: Props) {
  const [panelRef, insets] = usePanelInsets()
  return (
    <div className="fixed inset-0 overflow-hidden bg-canvas" style={{ ['--sheet-h' as string]: `${insets.bottom ?? 0}px` }}>
      <MapInsetsContext.Provider value={insets}>
        <div className="absolute inset-0">{map}</div>
      </MapInsetsContext.Provider>

      {/* Yuqori panel */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1500] flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-4">
        <div className="pointer-events-auto rounded-2xl bg-surface/90 px-3 py-1.5 shadow-card backdrop-blur-md">
          <Logo />
        </div>
        {topCenter && <div className="pointer-events-auto hidden sm:block">{topCenter}</div>}
        <div className="pointer-events-auto">
          <UserMenu />
        </div>
      </header>

      {mapActions && (
        <div className="pointer-events-none absolute right-3 z-[1400] flex flex-col gap-2 max-lg:bottom-[calc(var(--sheet-h,50dvh)+0.75rem)] lg:top-20 lg:right-4">
          <div className="pointer-events-auto flex flex-col gap-2">{mapActions}</div>
        </div>
      )}

      <Notices />

      {/* Panel: mobil — pastki sheet, desktop — chap kartochka */}
      <aside
        ref={panelRef}
        className={cn(
          'absolute z-[1450] flex animate-sheet-in flex-col border border-line/60 bg-surface shadow-float',
          'inset-x-0 bottom-0 max-h-[min(78dvh,720px)] rounded-t-[28px] pb-[env(safe-area-inset-bottom)]',
          'lg:inset-x-auto lg:top-20 lg:bottom-auto lg:left-4 lg:max-h-[calc(100dvh-6rem)] lg:rounded-3xl',
        )}
      >
        <div className="flex justify-center pt-2.5 pb-1 lg:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4 lg:w-[420px] lg:p-5">{children}</div>
      </aside>
    </div>
  )
}
