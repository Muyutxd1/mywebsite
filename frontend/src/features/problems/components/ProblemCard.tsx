import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Card, Spinner } from '@/components/ui'
import { apiGet, ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { FullProblem, ProblemEntry } from '../types'
import { difficultyTone } from './difficulty'
import { ProblemBody } from './ProblemBody'
import { SolutionToggle } from './SolutionToggle'

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('shrink-0 text-faint transition-transform duration-200', open && 'rotate-180 text-accent')}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/** Body that lazily GETs the full problem only once expanded. */
function ProblemDetail({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['problems', 'detail', id],
    queryFn: () => apiGet<FullProblem>(`/api/problems/${encodeURIComponent(id)}`),
    staleTime: Infinity,
  })

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted">
        <Spinner size={18} /> 加载题目中…
      </div>
    )
  }

  if (query.isError || !query.data) {
    const msg = query.error instanceof ApiError ? query.error.message : '加载失败'
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-3 text-sm text-danger">
        {msg}，请重试。
      </div>
    )
  }

  const p = query.data
  return (
    <div className="pt-4">
      <ProblemBody source={p.problem_md || '*无题面*'} />
      {p.solution_md && <SolutionToggle solution={p.solution_md} />}
    </div>
  )
}

export function ProblemCard({
  entry,
  defaultOpen = false,
}: {
  entry: ProblemEntry
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const compName = entry.competition_zh || entry.competition.replace(/_/g, ' ')
  const topics = (entry.topics || []).filter((t) => t && t !== '未分类')

  return (
    <Card className={cn('overflow-hidden transition-shadow', open && 'shadow-[var(--shadow-lift)]')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] text-muted">
              {compName}
              {entry.year ? ` · ${entry.year}` : ''}
            </span>
            <Badge tone={difficultyTone(entry.difficulty)} className="px-2 py-0">
              {entry.difficulty_zh || '中'}
            </Badge>
          </div>
          <p className={cn('mt-1 truncate text-sm font-semibold text-fg', open && 'whitespace-normal')}>
            {entry.title}
          </p>
          {topics.length > 0 && (
            <div className="mt-1.5 hidden flex-wrap gap-1 sm:flex">
              {topics.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-fg-soft"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="border-t border-border-soft px-4 pb-5 sm:px-5">
          <ProblemDetail id={entry.id} />
        </div>
      )}
    </Card>
  )
}
