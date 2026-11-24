import { Clock3, MapPinned, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import Logo from './ui/Logo'

const FEATURES = [
  { icon: MapPinned, title: 'Jonli kuzatuv', text: 'Mashina qayerdaligini xaritada ko‘rib turasiz' },
  { icon: Clock3, title: 'Oldindan narx', text: 'Narx safardan oldin ma’lum — kutilmagan to‘lov yo‘q' },
  { icon: ShieldCheck, title: 'Tasdiqlangan haydovchilar', text: 'Har bir haydovchi admin tomonidan tekshiriladi' },
]

/** Kirish / ro'yxatdan o'tish: desktopda chapda brend paneli, o'ngda forma */
export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#111113] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Dekor: xarita to'ri va sariq nur */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-brand/25 blur-3xl" />
        <div className="relative">
          <Logo invert />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-5xl leading-[1.05] font-extrabold tracking-tight">
            Shahar bo‘ylab <span className="text-brand">tez</span> va qulay.
          </h2>
          <p className="mt-4 text-lg text-white/60">Bir necha bosishda taksi chaqiring — ilovadan yoki dispetcher orqali.</p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-brand">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{t}</span>
                  <span className="text-sm text-white/55">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} taksi.</p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[400px] animate-sheet-in">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  )
}
