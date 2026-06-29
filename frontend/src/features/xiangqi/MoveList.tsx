import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import type { MoveEntry } from './useXiangqiGame'

interface Cell {
  text: string
  index: number
}
interface Row {
  num: number
  red?: Cell
  black?: Cell
}

function toRows(entries: MoveEntry[]): Row[] {
  const rows: Row[] = []
  let n = 1
  let i = 0
  if (entries.length && entries[0].color === 'b') {
    rows.push({ num: n++, black: { text: entries[0].chinese, index: 0 } })
    i = 1
  }
  for (; i < entries.length; i += 2) {
    rows.push({
      num: n++,
      red: { text: entries[i].chinese, index: i },
      black: i + 1 < entries.length ? { text: entries[i + 1].chinese, index: i + 1 } : undefined,
    })
  }
  return rows
}

export function MoveList({ moveList }: { moveList: MoveEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = toRows(moveList)
  const lastIndex = moveList.length - 1

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [moveList.length])

  const cellCls = (cell: Cell | undefined) =>
    cn('rounded px-1.5 py-0.5', cell && cell.index === lastIndex && 'bg-accent/20 font-semibold text-accent')

  return (
    <div className="card flex max-h-72 flex-col p-0">
      <div className="border-b border-border-soft px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">
        着法记录
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-faint">尚未走子</p>
      ) : (
        <div ref={scrollRef} className="overflow-y-auto px-2 py-1.5 text-sm">
          {rows.map((row) => (
            <div key={row.num} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1 py-0.5">
              <span className="text-right text-xs text-faint">{row.num}.</span>
              <span className={cellCls(row.red)} style={{ color: row.red && row.red.index === lastIndex ? undefined : '#d98a86' }}>
                {row.red?.text ?? ''}
              </span>
              <span className={cellCls(row.black)} style={{ color: row.black && row.black.index === lastIndex ? undefined : '#c9cdda' }}>
                {row.black?.text ?? ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
