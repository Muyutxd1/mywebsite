import { Button } from '@/components/ui'
import { getTransformedCells, type Piece } from '../lib/polycubeEngine'
import type { ActiveSelection } from '../types'
import { MiniLayers } from './MiniLayers'

const ROT: { axis: 'x' | 'y' | 'z'; dir: 1 | -1; label: string }[] = [
  { axis: 'x', dir: 1, label: 'X ⟳' },
  { axis: 'y', dir: 1, label: 'Y ⟳' },
  { axis: 'z', dir: 1, label: 'Z ⟳' },
  { axis: 'x', dir: -1, label: 'X ⟲' },
  { axis: 'y', dir: -1, label: 'Y ⟲' },
  { axis: 'z', dir: -1, label: 'Z ⟲' },
]

export function ActivePiecePanel({
  piece,
  active,
  usage,
  onRotate,
  onCycle,
  onDeselect,
}: {
  piece: Piece
  active: ActiveSelection
  usage: number
  onRotate: (axis: 'x' | 'y' | 'z', dir: 1 | -1) => void
  /** Cycle through the 24 orientations one step — tap the preview. */
  onCycle: () => void
  onDeselect: () => void
}) {
  const cells = getTransformedCells(piece, active.rotIdx)
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3.5 w-3.5 rounded-sm" style={{ background: piece.color }} />
          <span className="text-sm font-semibold">{piece.name}</span>
        </div>
        <span className="shrink-0 text-xs text-muted">朝向 {active.rotIdx + 1}/24</span>
      </div>

      <button
        type="button"
        onClick={onCycle}
        title="点击切换朝向"
        className="my-2.5 flex w-full items-center gap-2 overflow-x-auto rounded-lg border border-border-soft bg-surface-2/60 p-1.5 transition-colors hover:border-accent/40 active:scale-[0.99]"
      >
        <MiniLayers cells={cells} color={piece.color} cellPx={9} />
        <span className="ml-auto shrink-0 pr-1 text-base text-muted">↻</span>
      </button>

      <div className="grid grid-cols-3 gap-1">
        {ROT.map((r) => (
          <button
            key={r.label}
            onClick={() => onRotate(r.axis, r.dir)}
            className="rounded-md bg-surface-2 py-1.5 text-xs font-medium text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg"
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-xs text-muted">已放置 {usage} 处</span>
        <Button size="sm" variant="ghost" onClick={onDeselect}>
          取消选择
        </Button>
      </div>
    </div>
  )
}
