import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { navLinks } from '@/data/tools'
import { cn } from '@/lib/cn'

export function Nav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname])

  const scrollToTools = (e: React.MouseEvent) => {
    e.preventDefault()
    setOpen(false)
    const go = () => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })
    if (location.pathname === '/') go()
    else {
      navigate('/')
      setTimeout(go, 120)
    }
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-lg px-3 py-1.5 text-sm transition-colors',
      isActive ? 'text-fg' : 'text-muted hover:text-fg',
    )

  return (
    <header className="glass sticky top-0 z-40 border-b">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <polygon points="12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10" />
            </svg>
          </span>
          <span className="text-cosmic">牧雨</span>
        </Link>

        {/* desktop */}
        <div className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          <a href="/#tools" onClick={scrollToTools} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-fg">
            更多
          </a>
        </div>

        {/* mobile toggle */}
        <button
          className="grid h-9 w-9 place-items-center rounded-lg text-fg-soft hover:bg-surface-2 md:hidden"
          aria-label="菜单"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {/* mobile drawer */}
      {open && (
        <div className="border-t border-border-soft bg-bg-soft px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm',
                    isActive ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <a href="/#tools" onClick={scrollToTools} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg">
              更多工具
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
