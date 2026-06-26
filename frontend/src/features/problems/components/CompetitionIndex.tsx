import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { CompetitionGroup, CompetitionInfo } from '../types'

/** Thin stacked bar of the difficulty mix within a competition. */
function DifficultyBar({ c }: { c: CompetitionInfo }) {
  const total = c.easy + c.medium + c.hard + c.elite
  if (!total) return null
  const seg = (n: number, cls: string, label: string) =>
    n > 0 && (
      <span
        className={cn('h-full', cls)}
        style={{ width: `${(100 * n) / total}%` }}
        title={`${label} ${n}`}
      />
    )
  return (
    <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-surface-3 shrink-0">
      {seg(c.easy, 'bg-success', '易')}
      {seg(c.medium, 'bg-cyan', '中')}
      {seg(c.hard, 'bg-warning', '难')}
      {seg(c.elite, 'bg-danger', '极难')}
    </div>
  )
}

function yearLabel(c: CompetitionInfo): string | null {
  if (!c.years_known || c.year_min == null) return null
  return c.year_min === c.year_max ? String(c.year_min) : `${c.year_min}–${c.year_max}`
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={cn('shrink-0 text-faint transition-transform', open && 'rotate-90')} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** Browse-by-competition: geo sections -> clickable competition rows. */
export function CompetitionIndex({
  groups,
  onSelect,
}: {
  groups: CompetitionGroup[]
  onSelect: (competition: string) => void
}) {
  // Expand the first group by default (or the sole group when a geo filter is on).
  const [open, setOpen] = useState<Record<string, boolean>>(
    groups.length ? { [groups[0].config]: true } : {},
  )

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-12 text-center text-muted">
        没有匹配的竞赛，放宽筛选试试。
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const isOpen = open[g.config] ?? false
        return (
          <div key={g.config} className="overflow-hidden rounded-xl border border-border-soft bg-surface">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [g.config]: !isOpen }))}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <Chevron open={isOpen} />
              <span className="font-semibold text-fg">{g.country_zh}</span>
              <span className="text-xs text-muted">{g.competitions.length} 个竞赛 · {g.count} 题</span>
            </button>
            {isOpen && (
              <ul className="divide-y divide-border-soft border-t border-border-soft">
                {g.competitions.map((c) => {
                  const yr = yearLabel(c)
                  return (
                    <li key={c.competition}>
                      <button
                        type="button"
                        onClick={() => onSelect(c.competition)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-fg-soft" title={c.competition}>
                          {c.competition}
                        </span>
                        {yr && <span className="shrink-0 text-xs text-faint">{yr}</span>}
                        <DifficultyBar c={c} />
                        <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-muted">
                          {c.count}
                        </span>
                        <svg className="shrink-0 text-faint" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
