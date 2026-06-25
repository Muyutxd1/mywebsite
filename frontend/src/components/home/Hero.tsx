import { Link } from 'react-router-dom'

export function Hero() {
  const toTools = (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-4xl px-6 pb-14 pt-20 text-center sm:pt-28">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.32em] text-accent/80">
          MUYU · 牧雨
        </p>
        <h1 className="text-balance text-4xl font-bold leading-[1.1] sm:text-6xl">
          <span className="text-cosmic">牧雨的小宇宙</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          在一片确定性的绿洲里，对抗外界所有的嘈杂和变动。
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#tools"
            onClick={toTools}
            className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-medium text-accent-fg shadow-[var(--shadow-glow)] transition-colors hover:bg-accent-strong"
          >
            探索全部工具
          </a>
          <Link
            to="/fortune"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-5 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <polygon points="12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10" />
            </svg>
            灵占一卦
          </Link>
        </div>
      </div>
    </section>
  )
}
