import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button, ErrorState, PageLoader, useToast } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { useProblem, useProblemContext, usePrefetchProblem } from '../api/queries'
import { parseFilters } from '../api/filters'
import { FavoriteButton } from '../components/FavoriteButton'
import { MarkButtons } from '../components/MarkButtons'
import { ProblemActionBar } from '../components/ProblemActionBar'
import { ProblemView } from '../components/ProblemView'
import { problemHeadline } from '../data/labels'
import { usePracticeStore, useMarkStatus, type MarkStatus } from '../store/practice'

export default function ProblemDetailPage() {
  const { id = '' } = useParams()
  const [sp] = useSearchParams()
  const toast = useToast()

  // ctx carries the originating list's filter set for prev/next continuity.
  const ctx = sp.get('ctx')
  const ctxFilters = useMemo(
    () => (ctx !== null ? parseFilters(new URLSearchParams(ctx)) : null),
    [ctx],
  )

  const { data, isLoading, error, refetch } = useProblem(id)
  const { data: context } = useProblemContext(id, ctxFilters)
  const prefetch = usePrefetchProblem()

  const mark = useMarkStatus(id)
  const setMark = usePracticeStore((s) => s.mark)
  const clearMark = usePracticeStore((s) => s.clearMark)

  const onMark = (status: MarkStatus) => {
    if (!data) return
    setMark(id, status, {
      difficulty: data.difficulty,
      level1: data.categories[0]?.split('>')[0]?.trim() ?? null,
      comp_zh: data.comp_zh,
    })
  }

  const copyLink = async () => {
    const url = window.location.href
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      } else {
        const ta = document.createElement('textarea')
        ta.value = url
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      toast('链接已复制', 'success')
    } catch {
      toast('复制失败，请手动复制地址栏', 'danger')
    }
  }

  if (isLoading) return <PageLoader label="加载题目…" />
  if (error || !data) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState
          title={notFound ? '题目不存在' : '加载失败'}
          description={notFound ? '该链接对应的题目不在题库里' : '网络或服务器错误，稍后再试'}
          onRetry={notFound ? undefined : () => refetch()}
        />
        <div className="mt-4 text-center">
          <Link to="/problems" className="text-sm text-accent hover:underline">
            ← 返回题库
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          to={data.comp_key ? `/problems/c/${data.comp_key}` : '/problems'}
          className="min-w-0 truncate text-xs text-muted hover:text-accent"
        >
          ← {data.comp_zh}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={copyLink}>
            复制链接
          </Button>
          <FavoriteButton id={id} />
        </div>
      </div>

      <header className="mb-4">
        <h1 className="text-lg font-bold sm:text-xl">{problemHeadline(data)}</h1>
        {data.competition_raw && data.competition_raw !== data.comp_zh && (
          <p className="mt-0.5 text-xs text-faint">来源标注：{data.competition_raw}</p>
        )}
      </header>

      <ProblemView problem={data} />

      {ctxFilters ? (
        <ProblemActionBar
          context={context}
          ctx={ctx}
          mark={mark}
          onMark={onMark}
          onClearMark={() => clearMark(id)}
          onPrefetch={prefetch}
        />
      ) : (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-border-soft bg-surface px-4 py-3">
          <span className="text-xs text-muted">标记做题结果</span>
          <MarkButtons value={mark} onMark={onMark} onClear={() => clearMark(id)} size="sm" />
        </div>
      )}
    </div>
  )
}
