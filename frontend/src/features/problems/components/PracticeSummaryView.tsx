import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  countResults,
  formatDuration,
  groupResults,
  sessionDurationMs,
  sessionEntries,
  type ResultCounts,
} from '../lib/session'
import type { PracticeSession } from '../store/practice'

function StackBar({ counts }: { counts: ResultCounts }) {
  const total = Math.max(counts.total, 1)
  const seg = (n: number, cls: string) =>
    n > 0 ? <div className={cls} style={{ width: `${(100 * n) / total}%` }} /> : null
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
      {seg(counts.solved, 'bg-success/80')}
      {seg(counts.attempted, 'bg-warning/80')}
      {seg(counts.failed, 'bg-danger/80')}
      {seg(counts.skipped, 'bg-surface-3')}
    </div>
  )
}

/** End-of-session stats + review-failed / restart actions. */
export function PracticeSummaryView({
  session,
  onReviewFailed,
  onRestart,
  onExit,
}: {
  session: PracticeSession
  onReviewFailed: (failedIds: string[]) => void
  onRestart: () => void
  onExit: () => void
}) {
  const entries = sessionEntries(session)
  const counts = countResults(entries)
  const failedIds = entries.filter((e) => e.result === 'failed').map((e) => e.id)
  const byDiff = groupResults(entries, (e) => e.snap?.difficulty && (
    { easy: '易', medium: '中', hard: '难', elite: '极难' } as Record<string, string>
  )[e.snap.difficulty])
  const byTopic = groupResults(entries, (e) => e.snap?.level1)

  const stat = (label: string, value: number, cls: string) => (
    <div className="rounded-xl border border-border-soft bg-surface p-3 text-center">
      <p className={cn('text-2xl font-bold', cls)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent/80">练习完成</p>
        <h2 className="mt-1 text-2xl font-bold">
          {session.label}
        </h2>
        <p className="mt-1 text-sm text-muted">
          做了 {counts.total} 题 · 用时 {formatDuration(sessionDurationMs(session))}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {stat('会做', counts.solved, 'text-success')}
        {stat('有思路', counts.attempted, 'text-warning')}
        {stat('不会', counts.failed, 'text-danger')}
        {stat('跳过', counts.skipped, 'text-muted')}
      </div>

      <div className="mt-4">
        <StackBar counts={counts} />
      </div>

      {byDiff.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">按难度</p>
          <div className="space-y-2">
            {byDiff.map((g) => (
              <div key={g.key} className="flex items-center gap-3 text-sm">
                <span className="w-10 shrink-0 text-fg-soft">{g.key}</span>
                <StackBar counts={g.counts} />
                <span className="w-14 shrink-0 text-right text-xs text-muted">
                  {g.counts.solved}/{g.counts.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {byTopic.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">按学科</p>
          <div className="space-y-2">
            {byTopic.slice(0, 6).map((g) => (
              <div key={g.key} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 truncate text-fg-soft">{g.key}</span>
                <StackBar counts={g.counts} />
                <span className="w-14 shrink-0 text-right text-xs text-muted">
                  {g.counts.solved}/{g.counts.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {failedIds.length > 0 && (
          <Button variant="secondary" onClick={() => onReviewFailed(failedIds)}>
            回顾不会的 {failedIds.length} 题
          </Button>
        )}
        <Button variant="secondary" onClick={onRestart}>
          再来一组
        </Button>
        <Button variant="ghost" onClick={onExit}>
          返回
        </Button>
      </div>
    </div>
  )
}
