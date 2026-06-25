import { useMemo } from 'react'
import {
  cellOwners,
  getTransformedCells,
  isValidPlacement,
  type BoardState,
  type Piece,
} from '../lib/polycubeEngine'
import type { ActiveSelection, HoveredCell } from '../types'

/**
 * Precise 2D placement surface for one Y-layer (the X–Z plane at y = activeY).
 * Place pieces by clicking like the 2D polyomino board; the 3D view shows the
 * result. Cells the active piece extends into ABOVE this layer get an indigo ring.
 */
export function LayerBoard({
  board,
  library,
  active,
  activeY,
  hovered,
  onHover,
  onPlace,
  onRemoveAt,
}: {
  board: BoardState
  library: Piece[]
  active: ActiveSelection | null
  activeY: number
  hovered: HoveredCell | null
  onHover: (cell: HoveredCell | null) => void
  onPlace: (x: number, z: number) => void
  onRemoveAt: (x: number, z: number) => void
}) {
  const { sx, sz } = board

  const ownersAtLayer = useMemo(() => {
    const m = new Map<string, string>()
    for (const [k, v] of cellOwners(board, library)) {
      const [x, y, z] = k.split(',').map(Number)
      if (y === activeY) m.set(`${x},${z}`, v.color)
    }
    return m
  }, [board, library, activeY])

  const piece = active ? library.find((p) => p.id === active.pieceId) : undefined

  const ghost = useMemo(() => {
    if (!piece || !active || !hovered) return null
    const cells = getTransformedCells(piece, active.rotIdx)
    const valid = isValidPlacement(board, library, piece.id, hovered.x, activeY, hovered.z, active.rotIdx)
    const here = new Set<string>()
    const above = new Set<string>()
    for (const [dx, dy, dz] of cells) {
      const key = `${hovered.x + dx},${hovered.z + dz}`
      if (dy === 0) here.add(key)
      else above.add(key)
    }
    return { here, above, valid }
  }, [piece, active, hovered, board, library, activeY])

  const cellPx = Math.max(16, Math.min(42, Math.floor(380 / Math.max(sx, sz))))

  return (
    <div className="inline-block rounded-xl border border-border-soft bg-surface-2 p-2">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${sx}, ${cellPx}px)`, gap: 2 }}
        onMouseLeave={() => onHover(null)}
      >
        {Array.from({ length: sz }).flatMap((_, z) =>
          Array.from({ length: sx }).map((_, x) => {
            const occ = ownersAtLayer.get(`${x},${z}`)
            const inHere = ghost?.here.has(`${x},${z}`)
            const inAbove = ghost?.above.has(`${x},${z}`) && !inHere
            const tint = inHere ? (ghost!.valid ? '#46d18a' : '#f0616d') : undefined
            return (
              <button
                key={`${x},${z}`}
                onMouseEnter={() => onHover({ x, y: activeY, z })}
                onClick={() => (occ ? onRemoveAt(x, z) : active ? onPlace(x, z) : undefined)}
                title={occ ? '点击移除该块' : active ? '点击放置' : '先选择一个积木块'}
                className="rounded-[3px] transition-colors"
                style={{
                  width: cellPx,
                  height: cellPx,
                  background: tint ?? occ ?? 'var(--color-surface-3)',
                  opacity: inHere ? 0.9 : 1,
                  boxShadow: inAbove
                    ? 'inset 0 0 0 2px #8b7bff'
                    : occ
                      ? 'inset 0 0 0 1px rgba(0,0,0,0.35)'
                      : 'inset 0 0 0 1px var(--color-border-soft)',
                }}
              />
            )
          }),
        )}
      </div>
    </div>
  )
}
