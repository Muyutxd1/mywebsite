import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * Debounced search input. On the home page it navigates to /problems/search;
 * on the search page it patches `q` in place (same component, `onSearch`).
 */
export function SearchBox({
  initial = '',
  placeholder = '搜索题目 / 解答 / 竞赛（中英文均可）…',
  autoFocus,
  onSearch,
  className,
}: {
  initial?: string
  placeholder?: string
  autoFocus?: boolean
  onSearch: (q: string) => void
  className?: string
}) {
  const [value, setValue] = useState(initial)
  const timer = useRef<number | null>(null)
  const latest = useRef(onSearch)
  latest.current = onSearch

  useEffect(() => setValue(initial), [initial])
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const schedule = (v: string) => {
    setValue(v)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => latest.current(v.trim()), 250)
  }

  return (
    <div className={cn('relative', className)}>
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => schedule(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (timer.current) window.clearTimeout(timer.current)
            latest.current(value.trim())
          }
        }}
        placeholder={placeholder}
        className={cn(
          'h-11 w-full rounded-xl border border-border-soft bg-surface-2 pl-10 pr-4 text-sm text-fg',
          'placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20',
        )}
      />
    </div>
  )
}
