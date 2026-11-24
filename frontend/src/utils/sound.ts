/**
 * Ovozli signallar (fayl kerak emas — Web Audio) va tebranish.
 * Brauzer ovozni faqat foydalanuvchi sahifada biror narsa bosgandan keyin ruxsat beradi:
 * birinchi bosishda avtomatik yoqiladi, shungacha `locked` — ekranda "Ovozni yoqish" ko'rsatiladi.
 */
import { create } from 'zustand'

type SoundState = {
  /** Brauzer hali ovozga ruxsat bermagan */
  locked: boolean
  /** Yangi buyurtma signali takrorlanmoqda */
  ringing: boolean
}

export const useSoundStore = create<SoundState>(() => ({ locked: true, ringing: false }))

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    return ctx
  } catch {
    return null
  }
}

const syncLocked = () => useSoundStore.setState({ locked: getCtx()?.state !== 'running' })

/** Ovozni yoqish (foydalanuvchi bosganda chaqiriladi) */
export async function unlockAudio(): Promise<boolean> {
  const c = getCtx()
  if (!c) return false
  try {
    if (c.state !== 'running') await c.resume()
  } catch {
    /* ruxsat berilmadi */
  }
  syncLocked()
  return c.state === 'running'
}

// Sahifadagi birinchi bosish / tugma — ovoz ochiladi
if (typeof window !== 'undefined') {
  const onGesture = () => {
    void unlockAudio().then((ok) => {
      if (!ok) return
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
    })
  }
  // capture: xarita kabi hodisani to'xtatadigan elementlar ham hisobga olinsin
  window.addEventListener('pointerdown', onGesture, true)
  window.addEventListener('keydown', onGesture, true)
}

export function playAlert(times = 3) {
  const c = getCtx()
  if (!c) return
  try {
    if (c.state === 'suspended') void c.resume().then(syncLocked, syncLocked)
    const start = c.currentTime
    for (let i = 0; i < times; i++) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = i % 2 ? 660 : 880
      const t = start + i * 0.25
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      osc.connect(gain).connect(c.destination)
      osc.start(t)
      osc.stop(t + 0.22)
    }
  } catch {
    /* ovoz chiqmasa — muhim emas, ekrandagi xabar bor */
  }
}

/** Telefonda tebranish (qo'llab-quvvatlansa) */
export function vibrate() {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    /* yo'q bo'lsa — muhim emas */
  }
}

const RING_EVERY_MS = 5000
const RING_MAX_MS = 60_000
let ringTimer: ReturnType<typeof setInterval> | null = null
let ringStartedAt = 0

/** Yangi buyurtma: darhol signal, keyin har 5 soniyada (ko'pi bilan 1 daqiqa yoki to'xtatilguncha) */
export function startRinging() {
  playAlert()
  vibrate()
  ringStartedAt = Date.now()
  if (ringTimer) return
  useSoundStore.setState({ ringing: true })
  ringTimer = setInterval(() => {
    if (Date.now() - ringStartedAt > RING_MAX_MS) return stopRinging()
    playAlert()
    vibrate()
  }, RING_EVERY_MS)
}

export function stopRinging() {
  if (ringTimer) clearInterval(ringTimer)
  ringTimer = null
  if (useSoundStore.getState().ringing) useSoundStore.setState({ ringing: false })
}
