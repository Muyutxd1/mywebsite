import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui'
import { drawThumbnail } from '../lib/drawBoard'
import { getTransformedCoords, getTransformLabel } from '../lib/polyominoMath'
import type { ActiveSelection, Piece } from '../types'

export function ActivePiecePanel({
  active,
  piece,
  usage,
  onRotate,
  onFlipH,
  onFlipV,
  onDeselect,
}: {
  active: ActiveSelection
  piece: Piece
  usage: number
  onRotate: () => void
  onFlipH: () => void
  onFlipV: () => void
  onDeselect: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const coords = getTransformedCoords(piece.shape, active.rotation, active.flipH, active.flipV)

  useEffect(() => {
    if (ref.current) drawThumbnail(ref.current, coords, piece.color, 96)
    // coords identity changes each render; depend on the transform inputs instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id, piece.color, active.rotation, active.flipH, active.flipV])

  const label = getTransformLabel(active)

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-surface">
          <canvas ref={ref} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-fg">{piece.name}</div>
          {label && <div className="mt-0.5 text-xs text-accent">{label}</div>}
          <div className="mt-1 text-xs text-muted">已使用: {usage} 个</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Button variant="secondary" size="sm" onClick={onRotate} title="旋转 (R)">
          旋转 R
        </Button>
        <Button variant="secondary" size="sm" onClick={onFlipH} title="水平翻转 (H)">
          翻转 H
        </Button>
        <Button variant="secondary" size="sm" onClick={onFlipV} title="垂直翻转 (V)">
          翻转 V
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onDeselect} className="mt-1.5 w-full" title="取消选择 (Esc)">
        取消选择 Esc
      </Button>
    </div>
  )
}
