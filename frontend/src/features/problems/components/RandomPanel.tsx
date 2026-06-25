import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui'
import { apiGet, ApiError } from '@/lib/api'
import type { FullProblem, ProblemFilters } from '../types'
import { difficultyTone } from './difficulty'
import { ProblemBody } from './ProblemBody'
import { SolutionToggle } from './SolutionToggle'

function buildQuery(filters: ProblemFilters): string {
  const params = new URLSearchParams()
  if (filters.competition) params.set('competition', filters.competition)
  if (filters.topic) params.set('topic', filters.topic)
  if (filters.year) params.set('year', filters.year)
  if (filters.q.trim()) params.set('q', filters.q.trim())
  const s = params.toString()
  return s ? `?${s}` : ''
}

export function RandomPanel({ filters }: { filters: ProblemFilters }) {
  const [problem, setProblem] = useState<FullProblem | null>(null)

  const mutation = useMutation({
    mutationFn: () => apiGet<FullProblem>(`/api/problems/random${buildQuery(filters)}`),
    onSuccess: (data) => setProblem(data),
  })

  const filtersActive =
    !!filters.competition || !!filters.topic || !!filters.year || !!filters.q.trim()

  const noMatch = mutation.isError && mutation.error instanceof ApiError && mutation.error.status === 404

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border-soft bg-surface px-6 py-8 text-center">
        <p className="text-sm text-muted">
          {filtersActive ? '在当前筛选范围内随机抽取一道题' : '从整个题库中随机抽取一道题'}
        </p>
        <Button
          size="lg"
          variant="gold"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          leftIcon={mutation.isPending ? <Spinner size={18} /> : <span aria-hidden>🎲</span>}
        >
          {mutation.isPending ? '抽题中…' : problem ? '再抽一道' : '随机抽一道题'}
        </Button>
      </div>

      {noMatch && (
        <EmptyState
          title="没有符合条件的题目"
          description="当前筛选范围为空，换个赛事或年份再试。"
        />
      )}

      {mutation.isError && !noMatch && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-center text-sm text-danger">
          抽题失败，请重试。
        </div>
      )}

      {problem && (
        <Card className="overflow-hidden">
          <div className="border-b border-border-soft px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[11px] text-muted">
                {problem.competition_zh || problem.competition.replace(/_/g, ' ')}
                {problem.year ? ` · ${problem.year}` : ''}
              </span>
              <Badge tone={difficultyTone(problem.difficulty)} className="px-2 py-0">
                {problem.difficulty_zh || '中'}
              </Badge>
            </div>
            <p className="mt-1 text-sm font-semibold text-fg">{problem.title}</p>
          </div>
          <div className="px-4 pb-5 pt-4 sm:px-5">
            <ProblemBody source={problem.problem_md || '*无题面*'} />
            {problem.solution_md && <SolutionToggle solution={problem.solution_md} />}
          </div>
        </Card>
      )}
    </div>
  )
}
