import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorState, PageLoader } from '@/components/ui'
import { useRegistry } from '../api/queries'
import { DailyCard } from '../components/DailyCard'
import { RegistryDirectory } from '../components/RegistryDirectory'
import { SearchBox } from '../components/SearchBox'
import { usePracticeStore } from '../store/practice'
import { sessionToQuery } from '../lib/session'

/** Legacy URL shapes (v1 tabs / series / flat filters) → new routes. */
function useLegacyRedirects() {
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  useEffect(() => {
    const tab = sp.get('tab')
    if (tab === 'favorites') return navigate('/problems/favorites', { replace: true })
    if (tab === 'random') return navigate('/problems/practice', { replace: true })
    const series = sp.get('series')
    if (series) {
      const rest = new URLSearchParams(sp)
      rest.delete('series')
      rest.delete('tab')
      return navigate(`/problems/c/${series}?${rest.toString()}`, { replace: true })
    }
    const legacyFilterKeys = ['q', 'config', 'level1', 'level2', 'level3', 'level4',
      'year', 'difficulty', 'problem_type', 'competition']
    if (legacyFilterKeys.some((k) => sp.get(k))) {
      const rest = new URLSearchParams(sp)
      rest.delete('tab')
      rest.delete('competition')
      return navigate(`/problems/search?${rest.toString()}`, { replace: true })
    }
  }, [sp, navigate])
}

function ContinueCard() {
  const order = usePracticeStore((s) => s.sessionOrder)
  const sessions = usePracticeStore((s) => s.sessions)
  const active = order.map((sid) => sessions[sid]).find((s) => s && !s.finishedAt)
  if (!active) return null
  const url = `/problems/practice/run?${sessionToQuery({
    f: active.f, mode: active.mode, seed: active.seed, n: active.n, sid: active.sid,
  })}`
  return (
    <Link
      to={url}
      className="flex items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface p-4 transition-colors hover:border-accent/40"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">继续练习</p>
        <p className="mt-1 truncate text-sm font-semibold text-fg">
          {active.label} · {Math.min(active.cursor + 1, active.ids.length)}/{active.ids.length} 题
        </p>
      </div>
      <span className="shrink-0 text-xs text-accent">继续 →</span>
    </Link>
  )
}

export default function ProblemsHomePage() {
  useLegacyRedirects()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useRegistry()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">
          Olympiad · 竞赛题库
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold sm:text-3xl">奥赛习题集</h1>
          {data && (
            <p className="text-sm text-muted">
              {data.total.toLocaleString()} 题 · {data.regions.reduce((s, r) => s + r.competitions.length, 0)} 个赛事
              {data.translated.problems > 0 &&
                ` · ${Math.round((100 * data.translated.problems) / data.total)}% 已翻译`}
            </p>
          )}
        </div>
      </header>

      <SearchBox
        className="mb-5"
        onSearch={(q) => {
          if (q) navigate(`/problems/search?q=${encodeURIComponent(q)}`)
        }}
      />

      <div className="mb-8 space-y-3">
        <DailyCard />
        <ContinueCard />
        <div className="flex flex-wrap gap-2 text-sm">
          <Link to="/problems/search" className="text-accent underline-offset-2 hover:underline">
            高级筛选 →
          </Link>
          <span className="text-border">|</span>
          <Link to="/problems/practice" className="text-accent underline-offset-2 hover:underline">
            练习模式 →
          </Link>
          <span className="text-border">|</span>
          <Link to="/problems/favorites" className="text-accent underline-offset-2 hover:underline">
            我的收藏 →
          </Link>
        </div>
      </div>

      {isLoading && <PageLoader label="加载竞赛目录…" />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && <RegistryDirectory regions={data.regions} />}
    </div>
  )
}
