import { cn } from '@/lib/cn'

const SEGMENTS: { key: 'easy' | 'medium' | 'hard' | 'elite'; cls: string; zh: string }[] = [
  { key: 'easy', cls: 'bg-success/70', zh: '易' },
  { key: 'medium', cls: 'bg-cyan/70', zh: '中' },
  { key: 'hard', cls: 'bg-warning/70', zh: '难' },
  { key: 'elite', cls: 'bg-danger/70', zh: '极难' },
]

/** Stacked difficulty-distribution bar (green→red). */
export function DiffBar({
  diff,
  className,
}: {
  diff: { easy: number; medium: number; hard: number; elite: number }
  className?: string
}) {
  const total = diff.easy + diff.medium + diff.hard + diff.elite
  if (!total) return null
  return (
    <div
      className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
      title={SEGMENTS.map((s) => `${s.zh} ${diff[s.key]}`).join(' · ')}
    >
      {SEGMENTS.map((s) =>
        diff[s.key] > 0 ? (
          <div key={s.key} className={s.cls} style={{ width: `${(100 * diff[s.key]) / total}%` }} />
        ) : null,
      )}
    </div>
  )
}
