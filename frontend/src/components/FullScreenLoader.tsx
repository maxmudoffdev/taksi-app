import { LogoMark } from './ui/Logo'

export default function FullScreenLoader({ text }: { text?: string }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <LogoMark className="size-14 animate-pulse" />
      {text ? <p className="max-w-sm text-sm text-muted">{text}</p> : <span className="sr-only">Yuklanmoqda</span>}
    </div>
  )
}
