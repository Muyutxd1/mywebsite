import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import type { Move } from './types'

export function MoveList({ moves, turn }: { moves: Move[]; turn: 'w' | 'b' }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [moves.length])

  if (moves.length === 0) {
    return (
      <div className="flex min-h-[150px] flex-1 items-center justify-center rounded-lg border border-border-soft bg-surface-2 p-3">
        <p className="text-center text-sm text-faint">走法将显示在此处</p>
      </div>
    )
  }

  const rows: { num: number; white: string; black: string; whiteCurrent: boolean; blackCurrent: boolean }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    const num = Math.floor(i / 2) + 1
    const white = moves[i].san ?? '?'
    const black = i + 1 < moves.length ? (moves[i + 1].san ?? '?') : ''
    rows.push({
      num,
      white,
      black,
      whiteCurrent: i === moves.length - 1 && turn === 'b',
      blackCurrent: i + 1 === moves.length - 1 && turn === 'w',
    })
  }

  return (
    <div
      ref={scrollRef}
      className="min-h-[150px] flex-1 overflow-y-auto rounded-lg border border-border-soft bg-surface-2 p-2.5 font-mono text-[13px] leading-relaxed"
    >
      {rows.map((row) => (
        <div key={row.num} className="flex gap-2 rounded px-1.5 py-0.5">
          <span className="min-w-7 text-faint">{row.num}.</span>
          <span className={cn('flex-1 text-fg-soft', row.whiteCurrent && 'rounded bg-gold/15 px-1 text-fg')}>
            {row.white}
          </span>
          <span className={cn('flex-1 text-fg-soft', row.blackCurrent && 'rounded bg-gold/15 px-1 text-fg')}>
            {row.black}
          </span>
        </div>
      ))}
    </div>
  )
}
