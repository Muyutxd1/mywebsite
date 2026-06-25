import { useEffect, useRef, useState } from 'react'
import { Select } from '@/components/ui'
import type { FacetsResponse, ProblemFilters } from '../types'

/** Shorten an over-long competition label for the dropdown, matching legacy. */
function shortLabel(label: string): string {
  const s = label
    .replace('Asia Pacific Mathematics Olympiad', 'APMO')
    .replace('Romanian Master of Mathematics', 'RMM')
  return s.length > 30 ? s.slice(0, 30) + '…' : s
}

export function ProblemFilterBar({
  facets,
  filters,
  onChange,
  total,
  page,
  pages,
  loading,
}: {
  facets: FacetsResponse
  filters: ProblemFilters
  onChange: (patch: Partial<ProblemFilters>) => void
  total: number
  page: number
  pages: number
  loading?: boolean
}) {
  // Debounced search: keep a local mirror so typing is responsive, push to the
  // URL-synced filter state 250ms after the user stops.
  const [q, setQ] = useState(filters.q)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  // Sync local text when the filter is changed externally (e.g. back/forward).
  useEffect(() => {
    setQ(filters.q)
  }, [filters.q])

  useEffect(() => () => clearTimeout(timer.current), [])

  function onSearch(value: string) {
    setQ(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange({ q: value }), 250)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="赛事"
          className="h-9 w-auto min-w-[8rem] flex-1 text-xs sm:flex-none sm:text-sm"
          value={filters.competition}
          onChange={(e) => onChange({ competition: e.target.value })}
        >
          <option value="">全部赛事</option>
          {facets.competitions.map((c) => (
            <option key={c.value} value={c.value}>
              {shortLabel(c.label)}
            </option>
          ))}
        </Select>

        <Select
          aria-label="主题"
          className="h-9 w-auto min-w-[7rem] flex-1 text-xs sm:flex-none sm:text-sm"
          value={filters.topic}
          onChange={(e) => onChange({ topic: e.target.value })}
        >
          <option value="">全部主题</option>
          {facets.topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>

        <Select
          aria-label="年份"
          className="h-9 w-auto min-w-[6rem] flex-1 text-xs sm:flex-none sm:text-sm"
          value={filters.year}
          onChange={(e) => onChange({ year: e.target.value })}
        >
          <option value="">全部年份</option>
          {facets.years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>

        <div className="relative min-w-[10rem] flex-[2]">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="搜索题目 / 主题 / 赛事…"
            className="h-9 w-full rounded-full border border-border-soft bg-surface-2 pl-9 pr-3 text-sm text-fg placeholder:text-faint outline-none transition-colors focus:border-accent focus:bg-surface-3"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {loading ? (
            '检索中…'
          ) : total > 0 ? (
            <>
              共 <span className="font-semibold text-fg-soft">{total.toLocaleString()}</span> 题
              {pages > 1 && (
                <span className="text-faint">
                  {' · '}第 {page}/{pages} 页
                </span>
              )}
            </>
          ) : (
            '0 题'
          )}
        </span>
      </div>
    </div>
  )
}
