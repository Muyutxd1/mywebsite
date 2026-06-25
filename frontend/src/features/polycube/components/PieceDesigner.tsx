import { useMemo, useState } from 'react'
import { Button, Input } from '@/components/ui'
import { cn } from '@/lib/cn'
import { normalizeCells, type Cell } from '../lib/polycubeEngine'
import { MiniLayers } from './MiniLayers'

const D = 4 // designer volume is 4x4x4

/** Build a custom polycube by toggling voxels layer-by-layer. */
export function PieceDesigner({ onSave }: { onSave: (cells: Cell[], name: string) => void }) {
  const [set, setSet] = useState<Set<string>>(new Set())
  const [layer, setLayer] = useState(0)
  const [name, setName] = useState('')

  const toggle = (x: number, z: number) => {
    const k = `${x},${layer},${z}`
    setSet((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const cells = useMemo<Cell[]>(
    () => normalizeCells([...set].map((s) => s.split(',').map(Number) as Cell)),
    [set],
  )

  const save = () => {
    if (set.size === 0) return
    onSave(cells, name.trim())
    setSet(new Set())
    setName('')
    setLayer(0)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span>层 Y</span>
        {Array.from({ length: D }).map((_, y) => (
          <button
            key={y}
            onClick={() => setLayer(y)}
            className={cn(
              'h-6 w-6 rounded text-xs',
              layer === y ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-soft hover:bg-surface-3',
            )}
          >
            {y}
          </button>
        ))}
      </div>

      <div className="grid w-max" style={{ gridTemplateColumns: `repeat(${D}, 26px)`, gap: 2 }}>
        {Array.from({ length: D }).flatMap((_, z) =>
          Array.from({ length: D }).map((_, x) => {
            const on = set.has(`${x},${layer},${z}`)
            return (
              <button
                key={`${x},${z}`}
                onClick={() => toggle(x, z)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 3,
                  background: on ? '#8b7bff' : 'var(--color-surface-3)',
                  boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--color-border-soft)',
                }}
              />
            )
          }),
        )}
      </div>

      {set.size > 0 && (
        <div className="rounded-lg bg-surface-2 p-2">
          <div className="mb-1 text-[11px] text-muted">预览 · {set.size} 块</div>
          <MiniLayers cells={cells} color="#8b7bff" cellPx={8} />
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="块名称（可选）"
          maxLength={16}
          className="h-8 flex-1"
        />
        <Button size="sm" onClick={save} disabled={set.size === 0}>
          保存块
        </Button>
      </div>
    </div>
  )
}
