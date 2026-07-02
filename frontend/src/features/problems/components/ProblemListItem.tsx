import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { DifficultyBadge } from './DifficultyBadge'
import { FavoriteButton } from './FavoriteButton'
import { lastSegment, problemHeadline } from '../data/labels'
import { useLang } from '../store/prefs'
import { useMarkStatus } from '../store/practice'
import type { ProblemEntry } from '../types'

const STATUS_DOT: Record<string, string> = {
  solved: 'bg-success',
  attempted: 'bg-warning',
  failed: 'bg-danger',
}

/** One light list row: headline badges + server-side preview/snippet + star. */
export function ProblemListItem({
  problem,
  ctx,
}: {
  problem: ProblemEntry
  /** Query string forwarded as the detail page's prev/next context. */
  ctx?: string
}) {
  const lang = useLang()
  const status = useMarkStatus(problem.id)
  const preview =
    problem.snippet ||
    (lang === 'zh' && problem.preview_zh ? problem.preview_zh : problem.preview_en)

  const to = ctx ? `/problems/${problem.id}?ctx=${encodeURIComponent(ctx)}` : `/problems/${problem.id}`

  return (
    <Link
      to={to}
      className={cn(
        'group flex items-start gap-3 rounded-xl border border-border-soft bg-surface p-4 transition-colors',
        'hover:border-accent/40 hover:bg-surface-2',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {status && <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} />}
          <span className="font-medium text-fg">{problemHeadline(problem)}</span>
          <DifficultyBadge difficulty={problem.difficulty} difficultyZh={problem.difficulty_zh} />
          {problem.categories.slice(0, 2).map((c) => (
            <Badge key={c} tone="neutral" className="opacity-75">
              {lastSegment(c)}
            </Badge>
          ))}
          {problem.has_zh === 1 && (
            <Badge tone="cyan" className="opacity-75">
              中
            </Badge>
          )}
          {problem.hit_lang && (
            <Badge tone="accent" className="opacity-90">
              命中{problem.hit_lang === 'zh' ? '中文' : '原文'}
            </Badge>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{preview}</p>
      </div>
      <FavoriteButton id={problem.id} className="shrink-0" />
    </Link>
  )
}
