import { BellOff, Volume2 } from 'lucide-react'
import { playAlert, stopRinging, unlockAudio, useSoundStore } from '../../utils/sound'

/**
 * Onlayn haydovchi uchun: brauzer ovozni bloklagan bo'lsa — "Ovozni yoqish",
 * yangi buyurtma signali takrorlanayotgan bo'lsa — "Signalni to'xtatish".
 */
export default function SoundBar() {
  const { locked, ringing } = useSoundStore()

  if (ringing) {
    return (
      <button
        onClick={stopRinging}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-soft px-4 py-2.5 text-sm font-semibold text-amber-800 transition active:scale-[0.99] dark:text-brand"
      >
        <BellOff className="size-4" /> Signalni to‘xtatish
      </button>
    )
  }
  if (!locked) return null
  return (
    <button
      onClick={async () => {
        if (await unlockAudio()) playAlert(1)
      }}
      className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-amber-500/12 px-4 py-2.5 text-left text-sm transition active:scale-[0.99]"
    >
      <Volume2 className="size-5 shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1">
        <b className="block text-amber-800 dark:text-amber-400">Ovozni yoqing</b>
        <span className="text-muted">Yangi buyurtma signalini eshitish uchun bosing</span>
      </span>
    </button>
  )
}
