import { cn } from '@/lib/cn'
import { Button } from '@/components/ui'
import { PieceThumbnail } from './PieceThumbnail'
import type { Piece } from '../types'

export function PieceLibrary({
  library,
  activePieceId,
  usage,
  onSelect,
  onDelete,
}: {
  library: Piece[]
  activePieceId: string | null
  usage: (id: string) => number
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (library.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-muted">
        拼图库为空
        <br />
        使用下方设计器创建新拼图块
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-1.5">
      {library.map((piece) => {
        const used = usage(piece.id)
        const active = activePieceId === piece.id
        const isBuiltin = piece.id.startsWith('builtin_')
        return (
          <div
            key={piece.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(piece.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(piece.id)
              }
            }}
            className={cn(
              'group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
              active
                ? 'border-accent/50 bg-accent/10'
                : 'border-border-soft bg-surface-2 hover:border-border hover:bg-surface-3',
            )}
          >
            <PieceThumbnail shape={piece.shape} color={piece.color} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-fg">{piece.name}</div>
              {used > 0 && <div className="text-xs font-medium text-accent">×{used}</div>}
            </div>
            {!isBuiltin && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="删除拼图块"
                title="删除拼图块"
                className="h-7 w-7 shrink-0 text-faint hover:text-danger"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(piece.id)
                }}
              >
                ×
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
