import { useMemo } from 'react'
import { cellOwners, type BoardState, type Piece } from '../lib/polycubeEngine'
import { cn } from '@/lib/cn'

/** Cross-section thumbnails: every Y-layer as a small 2D map, top→bottom. */
export function LayerInspector({
  board,
  library,
  activeY,
  onPick,
}: {
  board: BoardState
  library: Piece[]
  activeY: number
  onPick: (y: number) => void
}) {
  const { sx, sy, sz } = board
  const owners = useMemo(() => cellOwners(board, library), [board, library])
  const layers = Array.from({ length: sy }, (_, i) => sy - 1 - i) // top first
  const dot = Math.max(4, Math.min(10, Math.floor(72 / Math.max(sx, sz))))

  return (
    <div className="flex flex-wrap gap-2">
      {layers.map((y) => {
        const filled = [...owners.entries()].filter(([k]) => Number(k.split(',')[1]) === y).length
        return (
          <button
            key={y}
            onClick={() => onPick(y)}
            className={cn(
              'rounded-lg border p-1.5 transition-colors',
              y === activeY ? 'border-accent bg-accent/10' : 'border-border-soft bg-surface-2 hover:border-border',
            )}
            title={`层 Y=${y} · ${filled}/${sx * sz} 已填`}
          >
            <div className="grid" style={{ gridTemplateColumns: `repeat(${sx}, ${dot}px)`, gap: 1 }}>
              {Array.from({ length: sz }).flatMap((_, z) =>
                Array.from({ length: sx }).map((_, x) => {
                  const c = owners.get(`${x},${y},${z}`)?.color
                  return (
                    <span
                      key={`${x},${z}`}
                      style={{
                        width: dot,
                        height: dot,
                        borderRadius: 1,
                        background: c ?? 'var(--color-surface-3)',
                        boxShadow: c ? 'none' : 'inset 0 0 0 1px var(--color-border-soft)',
                      }}
                    />
                  )
                }),
              )}
            </div>
            <div className={cn('mt-1 text-center text-[10px]', y === activeY ? 'text-accent' : 'text-muted')}>
              Y={y}
              {y === activeY && ' ·当前'}
            </div>
          </button>
        )
      })}
    </div>
  )
}
