import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ErrorState, PageLoader, Skeleton, Tabs } from '@/components/ui'
import { apiGet } from '@/lib/api'
import { ProblemFilterBar } from './components/ProblemFilterBar'
import { ProblemList } from './components/ProblemList'
import { Pager } from './components/Pager'
import { RandomPanel } from './components/RandomPanel'
import type { FacetsResponse, ProblemFilters, ProblemListResponse } from './types'

type Mode = 'browse' | 'random'

export default function ProblemsPage() {
  const [params, setParams] = useSearchParams()

  // Derive all state from the URL so it is shareable + survives reload/back.
  const filters: ProblemFilters = useMemo(
    () => ({
      competition: params.get('competition') ?? '',
      topic: params.get('topic') ?? '',
      year: params.get('year') ?? '',
      q: params.get('q') ?? '',
    }),
    [params],
  )
  const page = Math.max(1, Number(params.get('page')) || 1)
  const mode: Mode = params.get('tab') === 'random' ? 'random' : 'browse'

  /** Merge a patch into the query string. Filter changes reset to page 1. */
  const patch = useCallback(
    (next: Record<string, string>, resetPage = false) => {
      setParams(
        (prev) => {
          const sp = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(next)) {
            if (v) sp.set(k, v)
            else sp.delete(k)
          }
          if (resetPage) sp.delete('page')
          return sp
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const onFilterChange = useCallback(
    (p: Partial<ProblemFilters>) => {
      patch(p as Record<string, string>, true)
    },
    [patch],
  )

  const onPage = useCallback(
    (p: number) => {
      patch({ page: p > 1 ? String(p) : '' })
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [patch],
  )

  const setMode = useCallback(
    (m: Mode) => patch({ tab: m === 'random' ? 'random' : '' }),
    [patch],
  )

  const facetsQuery = useQuery({
    queryKey: ['problems', 'facets'],
    queryFn: () => apiGet<FacetsResponse>('/api/problems/facets'),
    staleTime: Infinity,
  })

  if (facetsQuery.isLoading) {
    return (
      <Shell total={undefined}>
        <PageLoader label="正在准备题库…" />
      </Shell>
    )
  }

  if (facetsQuery.isError || !facetsQuery.data) {
    return (
      <Shell total={undefined}>
        <ErrorState
          title="题库加载失败"
          description="请刷新页面重试。"
          onRetry={() => void facetsQuery.refetch()}
        />
      </Shell>
    )
  }

  const facets = facetsQuery.data

  return (
    <Shell total={facets.total}>
      <Tabs<Mode>
        className="mb-6"
        value={mode}
        onChange={setMode}
        tabs={[
          { value: 'browse', label: '📋 浏览' },
          { value: 'random', label: '🎲 随机练习' },
        ]}
      />

      {mode === 'browse' ? (
        <BrowseTab
          facets={facets}
          filters={filters}
          page={page}
          onFilterChange={onFilterChange}
          onPage={onPage}
        />
      ) : (
        <RandomPanel filters={filters} />
      )}
    </Shell>
  )
}

function BrowseTab({
  facets,
  filters,
  page,
  onFilterChange,
  onPage,
}: {
  facets: FacetsResponse
  filters: ProblemFilters
  page: number
  onFilterChange: (p: Partial<ProblemFilters>) => void
  onPage: (p: number) => void
}) {
  const listQuery = useQuery({
    queryKey: ['problems', 'list', filters, page],
    queryFn: () => {
      const sp = new URLSearchParams()
      if (filters.competition) sp.set('competition', filters.competition)
      if (filters.topic) sp.set('topic', filters.topic)
      if (filters.year) sp.set('year', filters.year)
      if (filters.q.trim()) sp.set('q', filters.q.trim())
      sp.set('page', String(page))
      sp.set('pageSize', '20')
      return apiGet<ProblemListResponse>(`/api/problems?${sp.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const data = listQuery.data

  return (
    <div className="space-y-5">
      <ProblemFilterBar
        facets={facets}
        filters={filters}
        onChange={onFilterChange}
        total={data?.total ?? 0}
        page={data?.page ?? page}
        pages={data?.pages ?? 0}
        loading={listQuery.isLoading || listQuery.isFetching}
      />

      {listQuery.isError ? (
        <ErrorState
          title="题目加载失败"
          description="请稍后重试。"
          onRetry={() => void listQuery.refetch()}
        />
      ) : !data ? (
        <ListSkeleton />
      ) : (
        <div className={listQuery.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <ProblemList items={data.items} />
          <Pager page={data.page} pages={data.pages} onPage={onPage} />
        </div>
      )}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
      ))}
    </div>
  )
}

function Shell({ total, children }: { total: number | undefined; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-7">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">
          Olympiad · 竞赛题库
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">奥赛习题集</h1>
        <p className="mt-2 text-muted">
          MathNet 开源题库
          {total != null && (
            <>
              {' · '}
              <span className="font-semibold text-fg-soft">{total.toLocaleString()}</span> 道竞赛题
            </>
          )}
          {' · CC BY 4.0'}
        </p>
      </header>
      {children}
    </div>
  )
}
