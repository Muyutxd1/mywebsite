import { cn } from '@/lib/cn'
import type { CompetitionMatrixResponse } from '../types'

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent/40 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

/** Horizontally-scrolling year chips + round chips for a competition page. */
export function YearRoundChips({
  matrix,
  year,
  round,
  onYear,
  onRound,
}: {
  matrix: CompetitionMatrixResponse
  year: string
  round: string
  onYear: (y: string) => void
  onRound: (r: string) => void
}) {
  const rounds = matrix.comp.rounds
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">年份</span>
        <Chip active={!year} onClick={() => onYear('')}>
          全部
        </Chip>
        {matrix.by_year.map((y) => (
          <Chip key={y.year} active={year === String(y.year)} onClick={() => onYear(String(y.year))}>
            {y.year}
            <span className="ml-1 opacity-60">{y.count}</span>
          </Chip>
        ))}
        {matrix.unknown_year_count > 0 && (
          <Chip active={year === 'unknown'} onClick={() => onYear('unknown')}>
            未知<span className="ml-1 opacity-60">{matrix.unknown_year_count}</span>
          </Chip>
        )}
      </div>
      {rounds.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">卷</span>
          <Chip active={!round} onClick={() => onRound('')}>
            全部
          </Chip>
          {rounds.map((r) => (
            <Chip key={r.round_key} active={round === r.round_key} onClick={() => onRound(r.round_key)}>
              {r.zh}
              {r.count !== undefined && <span className="ml-1 opacity-60">{r.count}</span>}
            </Chip>
          ))}
        </div>
      )}
    </div>
  )
}
