import { useState } from 'react'
import { Button, Sheet } from '@/components/ui'
import { cn } from '@/lib/cn'

export interface PracticeSetup {
  mode: 'seq' | 'random'
  n: number // 0 = 全部（后端上限 500）
  skipSolved: boolean
}

function OptChip({
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
        'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent/40',
      )}
    >
      {children}
    </button>
  )
}

/** Session options collector; the owner builds the session and navigates. */
export function PracticeSetupSheet({
  open,
  onClose,
  label,
  total,
  onStart,
}: {
  open: boolean
  onClose: () => void
  label: string
  total: number
  onStart: (setup: PracticeSetup) => void
}) {
  const [mode, setMode] = useState<'seq' | 'random'>('random')
  const [n, setN] = useState(20)
  const [skipSolved, setSkipSolved] = useState(true)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="开始练习"
      footer={
        <Button className="w-full" onClick={() => onStart({ mode, n, skipSolved })} disabled={total === 0}>
          开始 →
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm">
          <span className="text-muted">集合：</span>
          <span className="font-medium text-fg">{label}</span>
          <span className="ml-1 text-muted">· {total} 题</span>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">出题顺序</p>
          <div className="flex gap-2">
            <OptChip active={mode === 'seq'} onClick={() => setMode('seq')}>
              按顺序
            </OptChip>
            <OptChip active={mode === 'random'} onClick={() => setMode('random')}>
              随机
            </OptChip>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">题量</p>
          <div className="flex flex-wrap gap-2">
            {[10, 20, 50, 0].map((v) => (
              <OptChip key={v} active={n === v} onClick={() => setN(v)}>
                {v === 0 ? `全部（≤500）` : `${v} 题`}
              </OptChip>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-fg-soft">
          <input
            type="checkbox"
            checked={skipSolved}
            onChange={(e) => setSkipSolved(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          跳过已标记「会做」的题
        </label>
      </div>
    </Sheet>
  )
}
