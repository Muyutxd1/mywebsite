import { cn } from '@/lib/cn'

/**
 * Render six 爻 (yang=solid bar, yin=split bar) bottom→top.
 * `lines` is bottom→top with 1=阳 / 0=阴; `moving` lists 1-indexed moving 爻.
 */
export function HexagramDiagram({
  lines,
  moving = [],
  className,
}: {
  lines: number[]
  moving?: number[]
  className?: string
}) {
  const mv = new Set(moving)
  // Visually top→bottom: position 6 (上爻) first.
  const order = [...lines].map((v, i) => ({ value: v, pos: i + 1 })).reverse()

  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      {order.map(({ value, pos }) => {
        const isMoving = mv.has(pos)
        const barBase = cn(
          'h-2 rounded-sm transition-colors',
          isMoving ? 'bg-gold shadow-[0_0_8px_var(--color-gold)]' : 'bg-fg-soft/80',
        )
        return (
          <div key={pos} className="flex h-2 w-28 items-center gap-1" title={`第${pos}爻${isMoving ? ' · 动' : ''}`}>
            {value === 1 ? (
              <span className={cn(barBase, 'w-full')} />
            ) : (
              <>
                <span className={cn(barBase, 'w-[44%]')} />
                <span className={cn(barBase, 'w-[44%]')} />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
