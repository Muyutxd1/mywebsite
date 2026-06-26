import { useState } from 'react'
import { cn } from '@/lib/cn'
import { ProblemBody } from './ProblemBody'

const ORD = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

/**
 * Spoiler-safe reveal for a problem's solution(s) + final answer. Solutions are
 * mounted lazily so KaTeX only renders once the user opts in.
 */
export function SolutionsSection({
  solutions,
  finalAnswer,
}: {
  solutions: string[]
  finalAnswer?: string | null
}) {
  const [open, setOpen] = useState(false)
  const has = solutions.length > 0 || Boolean(finalAnswer)

  if (!has) {
    return (
      <div className="mt-5 rounded-lg border border-dashed border-border-soft bg-surface-2 px-4 py-3 text-sm text-muted">
        本题暂无解答
      </div>
    )
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
          open
            ? 'border-accent/40 bg-accent/12 text-accent'
            : 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent/40 hover:text-accent',
        )}
      >
        <svg className={cn('transition-transform duration-200', open && 'rotate-180')} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
        {open ? '隐藏解答' : `查看解答${solutions.length > 1 ? `（${solutions.length} 种解法）` : ''}`}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {finalAnswer && (
            <div className="rounded-xl border-l-2 border-gold/60 bg-gold/8 px-4 py-3 sm:px-5">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gold">最终答案</div>
              <ProblemBody source={finalAnswer} />
            </div>
          )}
          {solutions.map((s, i) => (
            <div key={i} className="rounded-xl border-l-2 border-accent/60 bg-surface-2 px-4 py-3 sm:px-5">
              {solutions.length > 1 && (
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">
                  解法{ORD[i] ?? i + 1}
                </div>
              )}
              <ProblemBody source={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
