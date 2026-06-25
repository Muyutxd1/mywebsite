import { pieceBounds, type Cell } from '../lib/polycubeEngine'

/** Compact preview of a polycube as a row of per-Y-layer 2D grids (bottom→top). */
export function MiniLayers({
  cells,
  color,
  cellPx = 7,
}: {
  cells: Cell[]
  color: string
  cellPx?: number
}) {
  if (cells.length === 0) return null
  const [bx, by, bz] = pieceBounds(cells)
  const set = new Set(cells.map((c) => c.join(',')))
  const layers = Array.from({ length: by }, (_, y) => y)

  return (
    <div className="flex flex-wrap items-end gap-1.5">
      {layers.map((y) => (
        <div
          key={y}
          className="grid"
          style={{ gridTemplateColumns: `repeat(${bx}, ${cellPx}px)`, gap: 1 }}
        >
          {Array.from({ length: bz }).flatMap((_, z) =>
            Array.from({ length: bx }).map((_, x) => {
              const on = set.has(`${x},${y},${z}`)
              return (
                <span
                  key={`${x},${z}`}
                  style={{
                    width: cellPx,
                    height: cellPx,
                    borderRadius: 1,
                    background: on ? color : 'transparent',
                    boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--color-border-soft)',
                  }}
                />
              )
            }),
          )}
        </div>
      ))}
    </div>
  )
}
