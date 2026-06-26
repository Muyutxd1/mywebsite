import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Card, CardBody, EmptyState, Spinner } from '@/components/ui'
import { apiGet, ApiError } from '@/lib/api'
import { filtersToQuery } from '../api'
import { ProblemDetail } from './ProblemDetail'
import type { FullProblem, ProblemFilters } from '../types'

export function RandomPanel({ filters }: { filters: ProblemFilters }) {
  const [problem, setProblem] = useState<FullProblem | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      apiGet<FullProblem>(`/api/problems/random?${filtersToQuery(filters)}`),
    onSuccess: setProblem,
  })

  const active = Object.values(filters).some((v) => v && v.trim())
  const noMatch =
    mutation.isError && mutation.error instanceof ApiError && mutation.error.status === 404

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border-soft bg-surface px-6 py-8 text-center">
        <p className="text-sm text-muted">
          {active ? '在当前筛选范围内随机抽取一道题' : '从整个题库中随机抽取一道题'}
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
        <EmptyState title="没有符合条件的题目" description="当前筛选范围为空，换个条件再试。" />
      )}
      {mutation.isError && !noMatch && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-center text-sm text-danger">
          抽题失败，请重试。
        </div>
      )}

      {problem && (
        <Card>
          <CardBody>
            <ProblemDetail p={problem} />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
