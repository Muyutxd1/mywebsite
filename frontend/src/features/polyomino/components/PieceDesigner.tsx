import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input } from '@/components/ui'
import { normalizeCoords } from '../lib/polyominoMath'
import type { Coord } from '../types'

const GRID = 8
const BOX = 240

function emptyCells(): boolean[][] {
  return Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => false))
}

export function PieceDesigner({
  onSave,
}: {
  /** Returns true if the save succeeded (designer then resets). */
  onSave: (shape: Coord[], name: string) => boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cells, setCells] = useState<boolean[][]>(emptyCells)
  const [name, setName] = useState('')

  const render = useCallback((grid: boolean[][]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.round(BOX * dpr)
    canvas.height = Math.round(BOX * dpr)
    canvas.style.width = '100%'
    canvas.style.aspectRatio = '1 / 1'
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cs = BOX / GRID
    ctx.fillStyle = '#11131a'
    ctx.fillRect(0, 0, BOX, BOX)
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (grid[r][c]) {
          ctx.fillStyle = '#7c5cff'
          ctx.fillRect(c * cs + 1, r * cs + 1, cs - 2, cs - 2)
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(c * cs, r * cs, cs, cs)
      }
    }
  }, [])

  useEffect(() => {
    render(cells)
  }, [cells, render])

  function toggleAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cs = rect.width / GRID
    const c = Math.floor((clientX - rect.left) / cs)
    const r = Math.floor((clientY - rect.top) / cs)
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return
    setCells((prev) => {
      const next = prev.map((row) => row.slice())
      next[r][c] = !next[r][c]
      return next
    })
  }

  function getShape(): Coord[] {
    const coords: Coord[] = []
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (cells[r][c]) coords.push([r, c])
      }
    }
    return normalizeCoords(coords)
  }

  function handleSave() {
    const shape = getShape()
    const ok = onSave(shape, name.trim())
    if (ok) {
      setCells(emptyCells())
      setName('')
    }
  }

  const count = cells.reduce((s, row) => s + row.filter(Boolean).length, 0)

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">点击格子绘制形状，命名后保存。形状需边相邻连通。</p>
      <canvas
        ref={canvasRef}
        className="w-full cursor-pointer rounded-lg border border-border-soft touch-none"
        onClick={(e) => toggleAt(e.clientX, e.clientY)}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') toggleAt(e.clientX, e.clientY)
        }}
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="拼图块名称（可选）"
      />
      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={count === 0} className="flex-1">
          保存拼图块
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setCells(emptyCells())
            setName('')
          }}
          disabled={count === 0}
        >
          清空
        </Button>
      </div>
    </div>
  )
}
