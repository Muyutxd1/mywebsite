import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ErrorState, PageLoader, Skeleton, Tabs } from '@/components/ui'
import { useCompetitions, useFacets, useFavoriteProblems, useProblemList } from './api'
import { useProblemsStore } from './store'
import { ProblemFilterBar } from './components/ProblemFilterBar'
import { ProblemList } from './components/ProblemList'
import { CompetitionIndex } from './components/CompetitionIndex'
import { Pager } from './components/Pager'
import { RandomPanel } from './components/RandomPanel'
import { DailyCard } from './components/DailyCard'
import { EMPTY_FILTERS } from './types'
import type { FacetsResponse, ProblemFilters } from './types'

type Mode = 'browse' | 'random' | 'favorites'
const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as (keyof ProblemFilters)[]

export default function ProblemsPage() {
  const [params, setParams] = useSearchParams()

  const filters: ProblemFilters = useMemo(() => {
    const f = { ...EMPTY_FILTERS }
    for (const k of FILTER_KEYS) f[k] = params.get(k) ?? ''
    return f
  }, [params])

  const page = Math.max(1, Number(params.get('page')) || 1)
  const mode: Mode =
    params.get('tab') === 'random' ? 'random' : params.get('tab') === 'favorites' ? 'favorites' : 'browse'

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
    (p: Partial<ProblemFilters>) => patch(p as Record<string, string>, true),
    [patch],
  )
  const onReset = useCallback(() => {
    const cleared: Record<string, string> = {}
    for (const k of FILTER_KEYS) cleared[k] = ''
    patch(cleared, true)
  }, [patch])
  const onPage = useCallback(
    (p: number) => {
      patch({ page: p > 1 ? String(p) : '' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [patch],
  )
  const setMode = useCallback((m: Mode) => patch({ tab: m === 'browse' ? '' : m }), [patch])

  const facetsQuery = useFacets()

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
        <ErrorState title="题库加载失败" description="请刷新页面重试。" onRetry={() => void facetsQuery.refetch()} />
      </Shell>
    )
  }
  const facets = facetsQuery.data

  return (
    <Shell total={facets.total}>
      <Tabs<Mode>
        className="mb-5"
        value={mode}
        onChange={setMode}
        tabs={[
          { value: 'browse', label: '题库' },
          { value: 'random', label: '随机' },
          { value: 'favorites', label: '收藏' },
        ]}
      />

      {mode === 'browse' && (
        <BrowseTab
          facets={facets}
          filters={filters}
          page={page}
          onFilterChange={onFilterChange}
          onReset={onReset}
          onPage={onPage}
        />
      )}
      {mode === 'random' && <RandomPanel filters={filters} />}
      {mode === 'favorites' && <FavoritesTab />}
    </Shell>
  )
}

function BrowseTab({
  facets,
  filters,
  page,
  onFilterChange,
  onReset,
  onPage,
}: {
  facets: FacetsResponse
  filters: ProblemFilters
  page: number
  onFilterChange: (p: Partial<ProblemFilters>) => void
  onReset: () => void
  onPage: (p: number) => void
}) {
  // Default browse unit is the COMPETITION; pick one to drill into its problems.
  const inCompetition = Boolean(filters.competition)
  const listQuery = useProblemList(filters, page, inCompetition)
  const compsQuery = useCompetitions(filters, !inCompetition)
  const data = listQuery.data

  return (
    <div className="space-y-5">
      <DailyCard />
      <ProblemFilterBar
        facets={facets}
        filters={filters}
        onChange={onFilterChange}
        onReset={onReset}
        total={inCompetition ? data?.total ?? 0 : compsQuery.data?.total ?? 0}
        page={data?.page ?? page}
        pages={inCompetition ? data?.pages ?? 0 : 0}
        loading={
          inCompetition
            ? listQuery.isLoading || listQuery.isFetching
            : compsQuery.isLoading || compsQuery.isFetching
        }
      />

      {inCompetition ? (
        <div className="space-y-3">
          <button
            onClick={() => onFilterChange({ competition: '' })}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            返回竞赛列表
          </button>
          <h2 className="text-lg font-bold">{filters.competition}</h2>
          {listQuery.isError ? (
            <ErrorState title="题目加载失败" description="请稍后重试。" onRetry={() => void listQuery.refetch()} />
          ) : !data ? (
            <ListSkeleton />
          ) : (
            <div className={listQuery.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <ProblemList items={data.items} />
              <Pager page={data.page} pages={data.pages} onPage={onPage} />
            </div>
          )}
        </div>
      ) : compsQuery.isError ? (
        <ErrorState title="竞赛加载失败" description="请稍后重试。" onRetry={() => void compsQuery.refetch()} />
      ) : !compsQuery.data ? (
        <ListSkeleton />
      ) : (
        <div className={compsQuery.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <CompetitionIndex
            groups={compsQuery.data.groups}
            onSelect={(competition) => onFilterChange({ competition })}
          />
        </div>
      )}
    </div>
  )
}

function FavoritesTab() {
  const favorites = useProblemsStore((s) => s.favorites)
  const ids = useMemo(
    () => Object.entries(favorites).sort((a, b) => b[1] - a[1]).map(([id]) => id),
    [favorites],
  )
  const { data, isLoading } = useFavoriteProblems(ids)

  if (ids.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-12 text-center text-muted">
        还没有收藏的题目。在任意题目卡片上点 ☆ 即可收藏。
      </div>
    )
  }
  if (isLoading || !data) return <ListSkeleton />
  return <ProblemList items={data} />
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[5.5rem] w-full rounded-xl" />
      ))}
    </div>
  )
}

function Shell({ total, children }: { total: number | undefined; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-7">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">Olympiad · 竞赛题库</p>
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
