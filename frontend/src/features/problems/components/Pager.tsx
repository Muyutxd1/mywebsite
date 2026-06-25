import { cn } from '@/lib/cn'

/** Server-driven page navigation: « ‹ [window of pages] › ». */
export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (p: number) => void
}) {
  if (pages <= 1) return null

  const start = Math.max(1, page - 2)
  const end = Math.min(pages, page + 2)
  const window: number[] = []
  for (let i = start; i <= end; i++) window.push(i)

  const go = (p: number) => () => {
    if (p >= 1 && p <= pages && p !== page) onPage(p)
  }

  const baseBtn =
    'inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border px-2.5 text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none'

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label="分页">
      <button className={cn(baseBtn, 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent hover:text-accent')} onClick={go(1)} disabled={page === 1} aria-label="首页">
        «
      </button>
      <button className={cn(baseBtn, 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent hover:text-accent')} onClick={go(page - 1)} disabled={page === 1} aria-label="上一页">
        ‹
      </button>

      {window.map((p) => (
        <button
          key={p}
          onClick={go(p)}
          aria-current={p === page ? 'page' : undefined}
          className={cn(
            baseBtn,
            p === page
              ? 'border-accent bg-accent text-accent-fg shadow-[var(--shadow-glow)]'
              : 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent hover:text-accent',
          )}
        >
          {p}
        </button>
      ))}

      <button className={cn(baseBtn, 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent hover:text-accent')} onClick={go(page + 1)} disabled={page === pages} aria-label="下一页">
        ›
      </button>
      <button className={cn(baseBtn, 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent hover:text-accent')} onClick={go(pages)} disabled={page === pages} aria-label="末页">
        »
      </button>
    </nav>
  )
}
