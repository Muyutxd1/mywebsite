import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import type { MoveRecord } from './types'

interface Cell {
  move: MoveRecord
  index: number
}
interface Row {
  num: number
  white?: Cell
  black?: Cell
}

function toRows(history: MoveRecord[]): Row[] {
  const rows: Row[] = []
  let n = 1
  let i = 0
  if (history.length && history[0].color === 'b') {
    rows.push({ num: n++, black: { move: history[0], index: 0 } })
    i = 1
  }
  for (; i < history.length; i += 2) {
    rows.push({
      num: n++,
      white: { move: history[i], index: i },
      black: i + 1 < history.length ? { move: history[i + 1], index: i + 1 } : undefined,
    })
  }
  return rows
}

export function MoveList({ history }: { history: MoveRecord[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = toRows(history)
  const lastIndex = history.length - 1

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history.length])

  const cellCls = (cell: Cell | undefined) =>
    cn('rounded px-1.5 py-0.5 tabular-nums', cell && cell.index === lastIndex && 'bg-accent/20 font-semibold text-accent')

  return (
    <div className="card flex max-h-72 flex-col p-0">
      <div className="border-b border-border-soft px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">
        走法记录
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-faint">尚未走子</p>
      ) : (
        <div ref={scrollRef} className="overflow-y-auto px-2 py-1.5 text-sm">
          {rows.map((row) => (
            <div key={row.num} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1 py-0.5">
              <span className="text-right text-xs text-faint">{row.num}.</span>
              <span className={cellCls(row.white)}>{row.white?.move.san ?? ''}</span>
              <span className={cellCls(row.black)}>{row.black?.move.san ?? ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
