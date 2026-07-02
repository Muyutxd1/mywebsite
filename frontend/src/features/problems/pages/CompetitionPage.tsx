import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useCompetitionMatrix, useProblemList } from '../api/queries'
import { EMPTY_FILTERS, filtersToQuery, useUrlFilters } from '../api/filters'
import { DiffBar } from '../components/DiffBar'
import { Pager } from '../components/Pager'
import { ProblemListItem } from '../components/ProblemListItem'
import { YearRoundChips } from '../components/YearRoundChips'
import { PracticeSetupSheet, type PracticeSetup } from '../components/PracticeSetupSheet'
import { useStartPractice } from '../lib/useStartPractice'
import { TIER_LABEL } from '../data/labels'

const DIFFS = [
  { value: '', zh: '全部' },
  { value: 'easy', zh: '易' },
  { value: 'medium', zh: '中' },
  { value: 'hard', zh: '难' },
  { value: 'elite', zh: '极难' },
]

export default function CompetitionPage() {
  const { compKey = '' } = useParams()
  const { filters: urlFilters, page, patch } = useUrlFilters()
  const [setupOpen, setSetupOpen] = useState(false)

  const { data: matrix, isLoading: matrixLoading, isError, refetch } = useCompetitionMatrix(compKey)

  const filters = useMemo(
    () => ({ ...EMPTY_FILTERS, ...urlFilters, comp: compKey, sort: urlFilters.sort || 'year_desc' }),
    [urlFilters, compKey],
  )
  const { data, isLoading, isPlaceholderData } = useProblemList(filters, page)
  const ctx = useMemo(() => filtersToQuery(filters), [filters])
  const startPractice = useStartPractice()

  const label = useMemo(() => {
    if (!matrix) return compKey
    const bits = [matrix.comp.short || matrix.comp.name_zh]
    if (filters.year && filters.year !== 'unknown') bits.push(filters.year)
    if (filters.round) {
      const r = matrix.comp.rounds.find((x) => x.round_key === filters.round)
      if (r) bits.push(r.zh)
    }
    if (filters.difficulty) bits.push(DIFFS.find((d) => d.value === filters.difficulty)?.zh ?? '')
    return bits.filter(Boolean).join(' · ')
  }, [matrix, compKey, filters])

  const onStart = (setup: PracticeSetup) => {
    setSetupOpen(false)
    startPractice({ f: ctx, label, setup })
  }

  if (matrixLoading) return <PageLoader label="加载竞赛信息…" />
  if (isError || !matrix)
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <ErrorState onRetry={() => refetch()} />
      </div>
    )

  const comp = matrix.comp
  const diffTotal = data?.total ?? comp.count

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to="/problems" className="text-xs text-muted hover:text-accent">
        ← 返回题库
      </Link>

      <header className="mt-2 rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold sm:text-2xl">{comp.name_zh}</h1>
              <Badge tone={comp.tier === 1 ? 'gold' : 'neutral'}>{TIER_LABEL[comp.tier]}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{comp.name_en}</p>
            <p className="mt-2 text-xs text-muted">
              {comp.count} 题
              {matrix.by_year.length > 0 &&
                ` · ${matrix.by_year[matrix.by_year.length - 1].year}–${matrix.by_year[0].year}`}
              {matrix.unknown_year_count > 0 && ` · ${matrix.unknown_year_count} 题年份未知`}
            </p>
          </div>
          <Button size="sm" onClick={() => setSetupOpen(true)}>
            ▶ 开始刷题
          </Button>
        </div>
      </header>

      <div className="mt-4 space-y-2">
        <YearRoundChips
          matrix={matrix}
          year={filters.year}
          round={filters.round}
          onYear={(y) => patch({ year: y })}
          onRound={(r) => patch({ round: r })}
        />
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">难度</span>
          {DIFFS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => patch({ difficulty: d.value })}
              aria-pressed={filters.difficulty === d.value}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                filters.difficulty === d.value
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent/40 hover:text-fg',
              )}
            >
              {d.zh}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>{diffTotal.toLocaleString()} 题</span>
        {data && data.pages > 1 && <span>第 {data.page}/{data.pages} 页</span>}
      </div>

      <div className="mt-3">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}
        {data && data.items.length === 0 && <EmptyState title="该筛选下暂无题目" />}
        {data && data.items.length > 0 && (
          <div className={cn('space-y-3 transition-opacity', isPlaceholderData && 'opacity-60')}>
            {data.items.map((p) => (
              <ProblemListItem key={p.id} problem={p} ctx={ctx} />
            ))}
          </div>
        )}
        {data && data.pages > 1 && (
          <Pager
            page={data.page}
            pages={data.pages}
            onPage={(p) => {
              patch({ page: p })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        )}
      </div>

      <PracticeSetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        label={label}
        total={diffTotal}
        onStart={onStart}
      />
    </div>
  )
}
