import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { useDaily } from '../api/queries'
import { DifficultyBadge } from './DifficultyBadge'
import { problemHeadline } from '../data/labels'

/** 今日一题 — a highlighted card linking to the daily problem's detail page. */
export function DailyCard() {
  const { data, isLoading } = useDaily()
  if (isLoading || !data) return null

  return (
    <Link to={`/problems/${data.id}`} className="block">
      <Card className="relative overflow-hidden border-accent/30 shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5">
        <div className="cat-glow pointer-events-none absolute -right-10 -top-10 h-40 w-40 opacity-50" />
        <div className="relative flex items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent/80">
              今日一题 · {data.date}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-fg">{problemHeadline(data)}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{data.comp_zh}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DifficultyBadge difficulty={data.difficulty} difficultyZh={data.difficulty_zh} />
            <span className="text-xs text-accent">查看 →</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
