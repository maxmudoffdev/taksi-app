import L from 'leaflet'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Marker } from 'react-leaflet'
import type { LatLng } from '../types'
import { bearing, distanceM, lerp } from './geo'

const ANIMATION_MS = 1000

/** Ustidan ko'rinishdagi taksi (yo'nalish bo'yicha buriladi) */
function carIcon(heading: number) {
  return L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 6px rgba(0,0,0,.35))">
      <svg width="26" height="40" viewBox="0 0 26 40" style="transform:rotate(${heading}deg)">
        <rect x="1" y="1" width="24" height="38" rx="8" fill="#ffcc00" stroke="#18181b" stroke-width="1.5"/>
        <path d="M5 11 Q13 6 21 11 L20 16 Q13 14 6 16 Z" fill="#18181b" opacity=".85"/>
        <path d="M6 29 Q13 31 20 29 L21 33 Q13 36 5 33 Z" fill="#18181b" opacity=".7"/>
        <rect x="8" y="19" width="10" height="5" rx="1.5" fill="#18181b"/>
        <text x="13" y="23" text-anchor="middle" font-size="3.6" font-weight="800" font-family="Inter,system-ui" fill="#ffcc00">TAXI</text>
      </svg>
    </div>`,
  })
}

/** Haydovchi markeri: yangi koordinata kelganda eski joyidan silliq suriladi */
type Props = { position: LatLng; heading: number | null; children?: ReactNode }

export default function AnimatedCarMarker({ position, heading, children }: Props) {
  const markerRef = useRef<L.Marker>(null)
  const shownRef = useRef<LatLng>(position)
  const headingRef = useRef<number>(heading ?? 0)

  // Yo'nalish kelmasa — harakat yo'nalishidan hisoblaymiz
  const prev = shownRef.current
  const moved = distanceM(prev, position) > 2
  const effectiveHeading = heading ?? (moved ? bearing(prev, position) : headingRef.current)
  headingRef.current = effectiveHeading
  const roundedHeading = Math.round(effectiveHeading / 5) * 5
  const icon = useMemo(() => carIcon(roundedHeading), [roundedHeading])

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    const from = shownRef.current
    // Juda uzoqqa "sakrasa" (masalan, birinchi GPS) — animatsiyasiz
    if (distanceM(from, position) > 2000) {
      marker.setLatLng(position)
      shownRef.current = position
      return
    }
    let frame = 0
    const startedAt = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / ANIMATION_MS)
      const p = lerp(from, position, t)
      marker.setLatLng(p)
      shownRef.current = p
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [position])

  // position prop faqat boshlang'ich joy uchun; keyingi harakat effekt orqali
  return (
    <Marker ref={markerRef} position={shownRef.current} icon={icon} zIndexOffset={1000}>
      {children}
    </Marker>
  )
}
