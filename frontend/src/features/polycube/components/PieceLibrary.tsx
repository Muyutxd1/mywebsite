import { cn } from '@/lib/cn'
import type { Piece } from '../lib/polycubeEngine'
import { MiniLayers } from './MiniLayers'

export function PieceLibrary({
  library,
  activeId,
  usage,
  onSelect,
  onDelete,
}: {
  library: Piece[]
  activeId: string | null
  usage: (id: string) => number
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {library.map((p) => {
        const builtin = p.id.startsWith('b_')
        const used = usage(p.id)
        return (
          <div
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 transition-colors',
              activeId === p.id
                ? 'border-accent bg-accent/10'
                : 'border-border-soft bg-surface-2 hover:border-border',
            )}
          >
            <div className="shrink-0">
              <MiniLayers cells={p.cells} color={p.color} cellPx={6} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{p.name}</div>
              <div className="text-[11px] text-faint">
                {p.cells.length} 块{used > 0 ? ` · 用 ${used}` : ''}
              </div>
            </div>
            {!builtin && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(p.id)
                }}
                className="shrink-0 px-1 text-faint transition-colors hover:text-danger"
                title="删除"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
