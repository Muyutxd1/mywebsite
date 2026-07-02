import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { DiffBar } from './DiffBar'
import type { CompetitionSummary } from '../types'

/** tier 1–2 card in the browse directory. */
export function CompetitionCard({ comp }: { comp: CompetitionSummary }) {
  const yearsRange =
    comp.year_min && comp.year_max
      ? comp.year_min === comp.year_max
        ? String(comp.year_min)
        : `${comp.year_min}–${comp.year_max}`
      : null

  return (
    <Link
      to={`/problems/c/${comp.comp_key}`}
      className={cn(
        'group flex flex-col gap-2 rounded-xl border border-border-soft bg-surface p-4 transition-all',
        'hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-glow)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg group-hover:text-accent">
            {comp.name_zh}
          </p>
          <p className="mt-0.5 truncate text-xs text-faint">{comp.name_en}</p>
        </div>
        {comp.tier === 1 && (
          <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold">
            国际
          </span>
        )}
      </div>
      <DiffBar diff={comp.diff} />
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{comp.count} 题</span>
        {yearsRange && <span>{yearsRange}</span>}
      </div>
    </Link>
  )
}

/** tier 3–4 compact row inside the collapsed「更多赛事」section. */
export function CompetitionRow({ comp }: { comp: CompetitionSummary }) {
  return (
    <Link
      to={`/problems/c/${comp.comp_key}`}
      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-2"
    >
      <span className="min-w-0 truncate text-fg-soft">{comp.name_zh}</span>
      <span className="shrink-0 text-xs text-faint">{comp.count} 题</span>
    </Link>
  )
}
