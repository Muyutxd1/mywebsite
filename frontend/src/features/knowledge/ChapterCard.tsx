import { cn } from '@/lib/cn'
import { KbEntry } from './KbEntry'
import type { KbChapter } from './types'

/** Chevron that rotates when the chapter is open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn('h-4 w-4 flex-shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * A single collapsible chapter. Entries are only KaTeX-rendered while `open`,
 * so collapsed chapters stay cheap.
 */
export function ChapterCard({
  chapter,
  open,
  onToggle,
  isGuide,
}: {
  chapter: KbChapter
  open: boolean
  onToggle: () => void
  isGuide?: boolean
}) {
  const count = chapter.entries?.length ?? 0

  return (
    <div
      className={cn(
        'card overflow-hidden border-border-soft transition-shadow',
        open && 'shadow-[var(--shadow-card)]',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 sm:px-5"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-accent-fg">
          {chapter.num}
        </span>
        <span className="flex-1 text-[15px] font-bold text-fg sm:text-base">{chapter.title}</span>
        <span className="text-xs text-muted">{count} 条</span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="border-t border-border-soft px-4 sm:px-5">
          {(chapter.entries ?? []).map((entry) => (
            <KbEntry key={entry.id} entry={entry} visible preLine={isGuide && entry.id === 0} />
          ))}
        </div>
      )}
    </div>
  )
}
