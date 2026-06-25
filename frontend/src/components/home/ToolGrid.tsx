import { tools } from '@/data/tools'
import { ToolCard } from './ToolCard'

export function ToolGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((t) => (
        <ToolCard key={t.slug} tool={t} />
      ))}
    </div>
  )
}
