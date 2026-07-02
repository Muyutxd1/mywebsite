import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { PracticeHistoryList } from '../components/PracticeHistoryList'
import { usePracticeStore } from '../store/practice'
import { DIFFICULTY_LABEL } from '../data/labels'

/** Aggregate the global progress map into simple headline stats. */
function useProgressStats() {
  const progress = usePracticeStore((s) => s.progress)
  return useMemo(() => {
    const entries = Object.values(progress)
    const byStatus = { solved: 0, attempted: 0, failed: 0 }
    const byDiff = new Map<string, { total: number; solved: number }>()
    const weekAgo = Date.now() - 7 * 86400_000
    let week = 0
    for (const e of entries) {
      byStatus[e.status]++
      if (e.ts >= weekAgo) week++
      const d = e.snap?.difficulty
      if (d) {
        const g = byDiff.get(d) ?? { total: 0, solved: 0 }
        g.total++
        if (e.status === 'solved') g.solved++
        byDiff.set(d, g)
      }
    }
    return { total: entries.length, byStatus, byDiff, week }
  }, [progress])
}

export default function PracticeHomePage() {
  const stats = useProgressStats()

  const stat = (label: string, value: number, cls?: string) => (
    <div className="rounded-xl border border-border-soft bg-surface p-3.5 text-center">
      <p className={cn('text-2xl font-bold', cls ?? 'text-fg')}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <Link to="/problems" className="text-xs text-muted hover:text-accent">
          ← 返回题库
        </Link>
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">练习模式</h1>
        <p className="mt-1 text-sm text-muted">
          从竞赛页或检索页点「开始练习」发起一组刷题；随机组卷的链接可以分享，同一链接出同一套题。
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat('累计打点', stats.total)}
        {stat('会做', stats.byStatus.solved, 'text-success')}
        {stat('不会', stats.byStatus.failed, 'text-danger')}
        {stat('近 7 天', stats.week, 'text-accent')}
      </div>

      {stats.byDiff.size > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            各难度会做率
          </p>
          <div className="space-y-2">
            {['easy', 'medium', 'hard', 'elite'].map((d) => {
              const g = stats.byDiff.get(d)
              if (!g) return null
              const pct = Math.round((100 * g.solved) / g.total)
              return (
                <div key={d} className="flex items-center gap-3 text-sm">
                  <span className="w-10 shrink-0 text-fg-soft">{DIFFICULTY_LABEL[d]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full bg-accent/80" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-muted">
                    {g.solved}/{g.total}（{pct}%）
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <span className="text-muted">发起入口：</span>
        <Link to="/problems" className="text-accent underline-offset-2 hover:underline">
          竞赛目录
        </Link>
        <Link to="/problems/search" className="text-accent underline-offset-2 hover:underline">
          高级筛选
        </Link>
        <Link to="/problems/favorites" className="text-accent underline-offset-2 hover:underline">
          我的收藏
        </Link>
      </div>

      <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted">
        练习记录
      </h2>
      <PracticeHistoryList />
    </div>
  )
}
