import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { FavoriteButton } from './FavoriteButton'
import { ProblemMeta } from './ProblemMeta'
import { useStatus } from '../store'
import type { ProblemEntry } from '../types'

/** Crude markdown/LaTeX -> plain text for a fast, non-KaTeX list preview. */
function plainPreview(md: string, max = 160): string {
  let s = md
    .replace(/\$\$[\s\S]*?\$\$/g, ' [公式] ')
    .replace(/\$[^$\n]+\$/g, ' [公式] ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' [图] ')
    .replace(/[#*_>`]/g, '')
    .replace(/^\s*Problem:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length > max) s = s.slice(0, max).trimEnd() + '…'
  return s
}

const STATUS_LABEL: Record<string, string> = { solved: '已解决', attempted: '尝试过' }

/** A list row: links to the detail route; favorite + progress at a glance. */
export function ProblemCard({ p }: { p: ProblemEntry }) {
  const status = useStatus(p.id)

  return (
    <Link
      to={`/problems/${p.id}`}
      className={cn(
        'group block rounded-xl border border-border-soft bg-surface p-4 transition-all',
        'hover:border-accent/40 hover:bg-surface-2 hover:shadow-[var(--shadow-card)]',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <ProblemMeta p={p} />
        <div className="flex shrink-0 items-center gap-1.5">
          {status && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                status === 'solved' ? 'bg-success/12 text-success' : 'bg-warning/12 text-warning',
              )}
            >
              {STATUS_LABEL[status]}
            </span>
          )}
          <FavoriteButton id={p.id} />
        </div>
      </div>
      <p className="text-sm leading-relaxed text-fg-soft">{plainPreview(p.problem_md)}</p>
    </Link>
  )
}
