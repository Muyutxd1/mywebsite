import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { MarkButtons } from './MarkButtons'
import type { MarkStatus } from '../store/practice'
import type { ContextResponse } from '../types'

/**
 * Sticky bottom bar on the detail page: prev / mark-tri-state / next.
 * Desktop adds ←/→ keyboard navigation. `ctx` is forwarded so the neighbor
 * detail pages keep the same prev/next context.
 */
export function ProblemActionBar({
  context,
  ctx,
  mark,
  onMark,
  onClearMark,
  onPrefetch,
}: {
  context: ContextResponse | undefined
  ctx: string | null
  mark: MarkStatus | undefined
  onMark: (s: MarkStatus) => void
  onClearMark: () => void
  onPrefetch?: (id: string | null | undefined) => void
}) {
  const navigate = useNavigate()
  const go = (id: string | undefined | null) => {
    if (!id) return
    navigate(`/problems/${id}${ctx ? `?ctx=${encodeURIComponent(ctx)}` : ''}`)
  }

  useEffect(() => {
    onPrefetch?.(context?.next?.id)
    onPrefetch?.(context?.prev?.id)
  }, [context, onPrefetch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft' && context?.prev) go(context.prev.id)
      if (e.key === 'ArrowRight' && context?.next) go(context.next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context])

  const navBtn = (dir: 'prev' | 'next') => {
    const target = context?.[dir]
    return (
      <button
        type="button"
        disabled={!target}
        onClick={() => go(target?.id)}
        title={target?.headline}
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-lg border border-border-soft bg-surface-2 px-3 py-1.5 text-sm transition-colors',
          target ? 'text-fg-soft hover:border-accent/40 hover:text-fg' : 'opacity-40',
        )}
      >
        {dir === 'prev' && <span aria-hidden>‹</span>}
        <span className="hidden max-w-[160px] truncate sm:inline">
          {target ? target.headline : dir === 'prev' ? '已是第一题' : '已是最后一题'}
        </span>
        <span className="sm:hidden">{dir === 'prev' ? '上一题' : '下一题'}</span>
        {dir === 'next' && <span aria-hidden>›</span>}
      </button>
    )
  }

  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border-soft bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
      <div className="flex items-center justify-between gap-2">
        {navBtn('prev')}
        <div className="flex flex-col items-center gap-0.5">
          <MarkButtons value={mark} onMark={onMark} onClear={onClearMark} size="sm" />
          {context?.index && context?.total && (
            <span className="text-[11px] text-faint">
              {context.index} / {context.total}
            </span>
          )}
        </div>
        {navBtn('next')}
      </div>
    </div>
  )
}
