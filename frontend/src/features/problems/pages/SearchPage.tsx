import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, ErrorState, Select, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFacets, useProblemList } from '../api/queries'
import { countActiveFilters, filtersToQuery, useUrlFilters, type ProblemFilters } from '../api/filters'
import { ActiveFilterChips, buildChips } from '../components/ActiveFilterChips'
import { FilterSheet } from '../components/FilterSheet'
import { Pager } from '../components/Pager'
import { ProblemListItem } from '../components/ProblemListItem'
import { SearchBox } from '../components/SearchBox'
import { PracticeSetupSheet, type PracticeSetup } from '../components/PracticeSetupSheet'
import { useStartPractice } from '../lib/useStartPractice'

const SORTS = [
  { value: '', label: '默认排序' },
  { value: 'relevance', label: '相关度' },
  { value: 'year_desc', label: '年份新→旧' },
  { value: 'year_asc', label: '年份旧→新' },
  { value: 'difficulty_asc', label: '难度低→高' },
  { value: 'difficulty_desc', label: '难度高→低' },
]

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

export default function SearchPage() {
  const { filters, page, patch, reset } = useUrlFilters()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)

  const { data: facets } = useFacets()
  const { data, isLoading, isError, refetch, isPlaceholderData } = useProblemList(filters, page)
  const nFilters = countActiveFilters(filters)
  const ctx = useMemo(() => filtersToQuery(filters), [filters])
  const startPractice = useStartPractice()

  const setLabel = useMemo(() => {
    const chips = buildChips(filters, facets).map((c) => c.label)
    if (filters.q) chips.unshift(`“${filters.q}”`)
    return chips.length ? chips.join(' · ') : '全部题目'
  }, [filters, facets])

  const applyAll = (f: ProblemFilters) => {
    const updates: Partial<ProblemFilters> = {}
    for (const k of Object.keys(f) as (keyof ProblemFilters)[]) updates[k] = f[k]
    patch(updates)
  }

  const onStart = (setup: PracticeSetup) => {
    setSetupOpen(false)
    startPractice({ f: ctx, label: setLabel, setup, total: data?.total ?? 0 })
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-2">
        <div>
          <Link to="/problems" className="text-xs text-muted hover:text-accent">
            ← 返回题库
          </Link>
          <h1 className="mt-1 text-xl font-bold sm:text-2xl">检索题目</h1>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox
          className="min-w-0 flex-1 basis-64"
          initial={filters.q}
          onSearch={(q) => patch({ q })}
        />
        <Button
          variant="secondary"
          onClick={() => setSheetOpen(true)}
          className={cn(nFilters > 0 && 'border-accent/40 text-accent')}
        >
          筛选{nFilters > 0 && `（${nFilters}）`}
        </Button>
        <Select
          value={filters.sort}
          onChange={(e) => patch({ sort: e.target.value })}
          className="w-36"
          aria-label="排序"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {facets && (
        <ActiveFilterChips
          className="mb-3"
          filters={filters}
          facets={facets}
          onPatch={patch}
          onClearAll={reset}
        />
      )}

      {data && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>
            共 {data.total.toLocaleString()} 题
            {data.pages > 1 && ` · 第 ${data.page}/${data.pages} 页`}
          </span>
          <Button size="sm" onClick={() => setSetupOpen(true)} disabled={data.total === 0}>
            ▶ 开始练习（{Math.min(data.total, 500)}）
          </Button>
        </div>
      )}

      {isLoading && <ListSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.items.length === 0 && (
        <EmptyState title="没有匹配的题目" description="试试放宽筛选或换个关键词" />
      )}
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

      {facets && (
        <FilterSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          filters={filters}
          facets={facets}
          onApply={applyAll}
        />
      )}
      <PracticeSetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        label={setLabel}
        total={data?.total ?? 0}
        onStart={onStart}
      />
    </div>
  )
}
