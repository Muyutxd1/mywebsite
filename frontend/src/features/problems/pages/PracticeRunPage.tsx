import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button, ErrorState, PageLoader } from '@/components/ui'
import { cn } from '@/lib/cn'
import { apiGet } from '@/lib/api'
import { useProblem, usePrefetchProblem } from '../api/queries'
import { MarkButtons } from '../components/MarkButtons'
import { ProblemView } from '../components/ProblemView'
import { PracticeSummaryView } from '../components/PracticeSummaryView'
import { problemHeadline } from '../data/labels'
import {
  idSetIds, isIdSet, seededShuffle, sessionFromQuery,
} from '../lib/session'
import { useStartPractice } from '../lib/useStartPractice'
import {
  usePracticeStore, useSession,
  type MarkStatus, type PracticeSession,
} from '../store/practice'
import type { IdListResponse, RandomIdsResponse } from '../types'

const BASE = '/api/problems'

/**
 * The immersive practice player. The URL alone (f/mode/seed/n/sid) rebuilds
 * the same problem sequence anywhere — local storage only adds your marks.
 */
export default function PracticeRunPage() {
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const params = useMemo(() => sessionFromQuery(sp), [sp])
  const session = useSession(params?.sid ?? null)
  const upsert = usePracticeStore((s) => s.upsertSession)
  const [rebuildError, setRebuildError] = useState(false)

  // Shared link / cleared storage: rebuild the session from the URL skeleton.
  useEffect(() => {
    if (!params || session || rebuildError) return
    let cancelled = false
    ;(async () => {
      try {
        let ids: string[]
        if (isIdSet(params.f)) {
          ids = idSetIds(params.f)
          // replay the same deterministic shuffle session creation applied
          if (params.mode === 'random') ids = seededShuffle(ids, params.seed)
        } else if (params.mode === 'random') {
          const res = await qc.fetchQuery({
            queryKey: ['problems', 'random', params.f, params.seed, 500],
            queryFn: () =>
              apiGet<RandomIdsResponse>(
                `${BASE}/random?${params.f}${params.f ? '&' : ''}seed=${params.seed}&count=500`),
            staleTime: Infinity,
          })
          ids = res.ids
        } else {
          const res = await qc.fetchQuery({
            queryKey: ['problems', 'ids', params.f, 500],
            queryFn: () =>
              apiGet<IdListResponse>(`${BASE}/ids?${params.f}${params.f ? '&' : ''}limit=500`),
            staleTime: Infinity,
          })
          ids = res.ids
        }
        if (params.sk) {
          // mirror the skip-solved filter (against THIS user's progress)
          const progress = usePracticeStore.getState().progress
          const remaining = ids.filter((id) => progress[id]?.status !== 'solved')
          if (remaining.length > 0) ids = remaining
        }
        if (params.n > 0) ids = ids.slice(0, params.n)
        if (cancelled || ids.length === 0) {
          if (!cancelled) setRebuildError(true)
          return
        }
        upsert({
          sid: params.sid,
          f: params.f,
          label: '练习',
          mode: params.mode,
          seed: params.seed,
          n: params.n,
          ids,
          cursor: 0,
          record: {},
          startedAt: Date.now(),
        })
      } catch {
        if (!cancelled) setRebuildError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params, session, rebuildError, qc, upsert])

  if (!params) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-muted">练习链接无效</p>
        <Link to="/problems/practice" className="mt-2 inline-block text-sm text-accent hover:underline">
          ← 练习模式
        </Link>
      </div>
    )
  }
  if (rebuildError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <ErrorState title="无法恢复该练习" description="集合为空或网络错误" />
      </div>
    )
  }
  if (!session) return <PageLoader label="准备练习…" />
  return <Player session={session} onExit={() => navigate('/problems/practice')} />
}

function Player({ session, onExit }: { session: PracticeSession; onExit: () => void }) {
  const { ids, cursor, sid } = session
  const finished = cursor >= ids.length
  const currentId = finished ? undefined : ids[cursor]

  // Belt-and-braces: the advance timer can be unmounted before it fires on
  // the last answer; stamp finishedAt whenever the summary actually shows.
  useEffect(() => {
    if (finished && !session.finishedAt) usePracticeStore.getState().finishSession(sid)
  }, [finished, session.finishedAt, sid])

  const { data: problem, isLoading, isError, refetch } = useProblem(currentId)
  const prefetch = usePrefetchProblem()
  useEffect(() => prefetch(ids[cursor + 1]), [cursor, ids, prefetch])

  const store = usePracticeStore
  const mark = usePracticeStore((s) => (currentId ? s.progress[currentId]?.status : undefined))
  const revealedRef = useRef(false)
  useEffect(() => {
    revealedRef.current = false
  }, [currentId])

  const advanceTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
  }, [])

  const startPractice = useStartPractice()

  const record = (result: MarkStatus | 'skipped') => {
    if (!currentId || !problem) return
    const snap = {
      difficulty: problem.difficulty,
      level1: problem.categories[0]?.split('>')[0]?.trim() ?? null,
      comp_zh: problem.comp_zh,
    }
    if (result !== 'skipped') store.getState().mark(currentId, result, snap)
    store.getState().recordAnswer(
      sid,
      { id: currentId, result, revealed: revealedRef.current, ts: Date.now(), snap },
    )
    // Brief pause so the button state registers, then advance — but only if
    // the user hasn't already navigated away from the answered problem.
    const answeredCursor = cursor
    advanceTimer.current = window.setTimeout(() => {
      const sess = store.getState().sessions[sid]
      if (!sess || sess.cursor !== answeredCursor) return
      const next = answeredCursor + 1
      store.getState().setCursor(sid, next)
      if (next >= ids.length) store.getState().finishSession(sid)
      window.scrollTo({ top: 0 })
    }, 250)
  }

  const goPrev = () => {
    if (cursor > 0) store.getState().setCursor(sid, cursor - 1)
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PracticeSummaryView
          session={session}
          onReviewFailed={(failedIds) =>
            startPractice({
              f: `ids:${failedIds.join(',')}`,
              label: `回顾错题（${session.label}）`,
              setup: { mode: 'seq', n: 0, skipSolved: false },
            })
          }
          onRestart={() =>
            startPractice({
              f: session.f,
              label: session.label,
              setup: { mode: session.mode, n: session.n, skipSolved: true },
            })
          }
          onExit={onExit}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 sm:px-6">
      {/* header: exit + progress */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          className="shrink-0 rounded-lg border border-border-soft bg-surface-2 px-2.5 py-1.5 text-xs text-fg-soft hover:text-fg"
        >
          ✕ 退出
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${(100 * cursor) / ids.length}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium text-muted">
          {cursor + 1} / {ids.length}
        </span>
      </div>

      {isLoading && <PageLoader label="加载题目…" />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {problem && (
        <>
          <h1 className="mb-3 text-base font-bold sm:text-lg">{problemHeadline(problem)}</h1>
          <ProblemView
            problem={problem}
            onRevealSolution={() => {
              revealedRef.current = true
            }}
            solutionNudge={
              !mark ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3.5 py-2.5 text-xs text-warning">
                  <span>看解答前先标记一下做题结果？</span>
                  <MarkButtons value={undefined} onMark={(s) => record(s)} size="sm" />
                </div>
              ) : null
            }
          />
        </>
      )}

      {/* sticky action bar */}
      <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border-soft bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={goPrev} disabled={cursor === 0}>
            ‹ 上一题
          </Button>
          <MarkButtons
            value={mark}
            onMark={(s) => record(s)}
            onClear={() => currentId && store.getState().clearMark(currentId)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => record('skipped')}
            className={cn('text-muted')}
          >
            跳过 ›
          </Button>
        </div>
      </div>
    </div>
  )
}
