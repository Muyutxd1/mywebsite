import { useState } from 'react'
import { cn } from '@/lib/cn'
import { ProblemBody } from './ProblemBody'

/** A reveal control + lazily-mounted solution body. */
export function SolutionToggle({ solution }: { solution: string }) {
  const [open, setOpen] = useState(false)

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
        <svg
          className={cn('transition-transform duration-200', open && 'rotate-180')}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        {open ? '隐藏解答' : '查看解答'}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border-l-2 border-accent/60 bg-surface-2 px-4 py-3 sm:px-5">
          <ProblemBody source={solution} />
        </div>
      )}
    </div>
  )
}
