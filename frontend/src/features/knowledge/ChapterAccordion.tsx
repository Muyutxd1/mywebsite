import { ChapterCard } from './ChapterCard'
import type { KbChapter } from './types'

/**
 * The chapter list. `openSet` holds the nums of chapters currently expanded.
 * `forceOpen` (set during an active search) overrides the per-chapter state so
 * every matching chapter is open.
 */
export function ChapterAccordion({
  chapters,
  openSet,
  onToggle,
  forceOpen,
}: {
  chapters: KbChapter[]
  openSet: Set<number>
  onToggle: (num: number) => void
  forceOpen?: boolean
}) {
  return (
    <div className="space-y-2">
      {chapters.map((chapter) => (
        <ChapterCard
          key={chapter.num}
          chapter={chapter}
          open={forceOpen || openSet.has(chapter.num)}
          onToggle={() => onToggle(chapter.num)}
          isGuide={chapter.num === 0}
        />
      ))}
    </div>
  )
}
