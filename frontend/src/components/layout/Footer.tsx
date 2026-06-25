import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border-soft">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted">
        <p>
          © 2026 牧雨 ·{' '}
          <a href="https://muyutxd1.com" className="text-fg-soft hover:text-accent">
            muyutxd1.com
          </a>
        </p>
        <p className="text-xs text-faint">
          <Link to="/projects" className="hover:text-fg-soft">
            项目展示
          </Link>{' '}
          · 在一片确定性的绿洲里
        </p>
      </div>
    </footer>
  )
}
