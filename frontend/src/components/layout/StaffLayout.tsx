import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import Notices from '../Notices'
import { cn } from '../ui/cn'
import Logo from '../ui/Logo'
import UserMenu from './UserMenu'

export type NavItem = {
  key: string
  label: string
  icon: ReactNode
  /** Sahifa ichidagi bo'lim (tab) */
  active?: boolean
  onClick?: () => void
  /** Boshqa sahifaga havola */
  to?: string
  badge?: number
}

/** Admin va dispetcher uchun: chapda menyu (desktop), tepada tablar (mobil) */
export default function StaffLayout({ nav, title, actions, children }: { nav: NavItem[]; title: string; actions?: ReactNode; children: ReactNode }) {
  const itemClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition [&>svg]:size-[18px]',
      active ? 'bg-ink text-on-ink shadow-card' : 'text-muted hover:bg-subtle hover:text-fg',
    )

  const renderItem = (item: NavItem, mobile = false) => {
    const content = (
      <>
        {item.icon}
        <span className={cn(mobile && 'whitespace-nowrap')}>{item.label}</span>
        {!!item.badge && (
          <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-on-brand">{item.badge}</span>
        )}
      </>
    )
    if (item.to) {
      return (
        <NavLink key={item.key} to={item.to} className={({ isActive }) => cn(itemClass(isActive), mobile && 'w-auto')}>
          {content}
        </NavLink>
      )
    }
    return (
      <button key={item.key} onClick={item.onClick} className={cn(itemClass(!!item.active), mobile && 'w-auto')}>
        {content}
      </button>
    )
  }

  return (
    <div className="min-h-full bg-canvas">
      {/* Desktop yon menyu */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface p-4 lg:flex">
        <div className="px-2 py-1">
          <Logo />
        </div>
        <nav className="mt-6 flex flex-col gap-1">{nav.map((i) => renderItem(i))}</nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="lg:hidden">
                <Logo />
              </span>
              <h1 className="hidden truncate text-xl font-bold tracking-tight lg:block">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <UserMenu />
            </div>
          </div>
          {/* Mobil tablar */}
          <nav className="scroll-thin flex gap-1 overflow-x-auto px-3 pb-3 lg:hidden">{nav.map((i) => renderItem(i, true))}</nav>
        </header>
        <Notices />
        <main className="px-4 py-5 lg:px-8 lg:py-6">
          <h1 className="mb-4 text-2xl font-bold tracking-tight lg:hidden">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  )
}
