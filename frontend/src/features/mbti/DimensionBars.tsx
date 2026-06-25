import { cn } from '@/lib/cn'
import type { DimensionResult } from './types'

/** A single bipolar split bar: dominant side colored, with %. */
function DimensionBar({ result }: { result: DimensionResult }) {
  const { dim, letter, score, max, pct } = result
  const leftWins = letter === dim.left
  const rightWins = letter === dim.right
  const pctLeft = pct
  const pctRight = 100 - pct

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={cn(leftWins ? 'font-bold text-accent' : 'text-muted')}>{dim.leftLabel}</span>
        <span className="text-[11px] tabular-nums text-faint">
          {score}/{max}
        </span>
        <span className={cn(rightWins ? 'font-bold text-accent' : 'text-muted')}>{dim.rightLabel}</span>
      </div>
      <div className="flex h-7 overflow-hidden rounded-lg bg-surface-2">
        <div
          className={cn(
            'flex items-center justify-center text-[11px] font-bold transition-[width] duration-700 ease-out',
            leftWins ? 'bg-accent text-accent-fg' : 'bg-surface-3 text-muted',
          )}
          style={{ width: `${pctLeft}%` }}
        >
          {pctLeft > 15 ? `${pctLeft}%` : ''}
        </div>
        <div
          className={cn(
            'flex flex-1 items-center justify-center text-[11px] font-bold transition-[width] duration-700 ease-out',
            rightWins ? 'bg-accent text-accent-fg' : 'bg-surface-3 text-muted',
          )}
        >
          {pctRight > 15 ? `${pctRight}%` : ''}
        </div>
      </div>
    </div>
  )
}

/** The 4 bipolar dimension bars (维度分析). */
export function DimensionBars({ results }: { results: DimensionResult[] }) {
  return (
    <div className="space-y-3.5">
      {results.map((r) => (
        <DimensionBar key={r.dim.key} result={r} />
      ))}
    </div>
  )
}
