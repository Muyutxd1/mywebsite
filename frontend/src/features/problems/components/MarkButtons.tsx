import { cn } from '@/lib/cn'
import type { MarkStatus } from '../store/practice'

const OPTIONS: { status: MarkStatus; zh: string; active: string; idle: string }[] = [
  {
    status: 'solved',
    zh: '会做',
    active: 'border-success/60 bg-success/15 text-success',
    idle: 'hover:border-success/50 hover:text-success',
  },
  {
    status: 'attempted',
    zh: '有思路',
    active: 'border-warning/60 bg-warning/15 text-warning',
    idle: 'hover:border-warning/50 hover:text-warning',
  },
  {
    status: 'failed',
    zh: '不会',
    active: 'border-danger/60 bg-danger/15 text-danger',
    idle: 'hover:border-danger/50 hover:text-danger',
  },
]

/** 会做 / 有思路 / 不会 tri-state; clicking the active state clears it. */
export function MarkButtons({
  value,
  onMark,
  onClear,
  size = 'md',
  className,
}: {
  value: MarkStatus | undefined
  onMark: (status: MarkStatus) => void
  onClear?: () => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {OPTIONS.map((o) => {
        const active = value === o.status
        return (
          <button
            key={o.status}
            type="button"
            aria-pressed={active}
            onClick={() => (active ? onClear?.() : onMark(o.status))}
            className={cn(
              'rounded-lg border font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active ? o.active : cn('border-border-soft bg-surface-2 text-fg-soft', o.idle),
            )}
          >
            {o.zh}
          </button>
        )
      })}
    </div>
  )
}
