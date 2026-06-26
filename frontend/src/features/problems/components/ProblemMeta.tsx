import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { DifficultyBadge } from './DifficultyBadge'
import { lastSegment } from '../data/labels'
import type { ProblemEntry } from '../types'

/** A wrapping row of metadata chips: competition · year · no · difficulty · type · topics. */
export function ProblemMeta({
  p,
  fullCategories = false,
  className,
}: {
  p: ProblemEntry
  fullCategories?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <Badge tone="accent">{p.country_zh}</Badge>
      {p.year ? (
        p.year_source === 'llm' ? (
          <Badge tone="neutral" className="opacity-80" title="AI 推断年份，仅供参考">
            {p.year}
            <span className="ml-0.5 text-[9px] text-faint">推</span>
          </Badge>
        ) : (
          <Badge tone="neutral">{p.year}</Badge>
        )
      ) : (
        <Badge tone="neutral" className="opacity-60">
          年份未知
        </Badge>
      )}
      {p.problem_number && <Badge tone="neutral">第 {p.problem_number} 题</Badge>}
      <DifficultyBadge difficulty={p.difficulty} difficultyZh={p.difficulty_zh} />
      {p.problem_type_zh && <Badge tone="cyan">{p.problem_type_zh}</Badge>}
      {p.has_images === 1 && <Badge tone="info">含图</Badge>}
      {p.categories.map((c) => (
        <Badge key={c} tone="gold" title={c}>
          {fullCategories ? c : lastSegment(c)}
        </Badge>
      ))}
    </div>
  )
}
