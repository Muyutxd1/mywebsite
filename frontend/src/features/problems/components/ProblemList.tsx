import { EmptyState } from '@/components/ui'
import type { ProblemEntry } from '../types'
import { ProblemCard } from './ProblemCard'

export function ProblemList({ items }: { items: ProblemEntry[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="没有匹配的题目"
        description="试着放宽筛选条件或清空搜索关键词。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((entry) => (
        <ProblemCard key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
