import { pieceSrc } from './pieces'
import type { Color, MoveRecord, PieceSymbol } from './types'

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const ORDER: Record<PieceSymbol, number> = { q: 0, r: 1, b: 2, n: 3, p: 4, k: 5 }

function sortPieces(list: PieceSymbol[]): PieceSymbol[] {
  return [...list].sort((a, b) => ORDER[a] - ORDER[b])
}

function sum(list: PieceSymbol[]): number {
  return list.reduce((acc, p) => acc + VALUE[p], 0)
}

/** 单方“战利品”行：展示其吃掉的对方棋子，以及领先时的净子力优势。 */
function Tray({ owner, captured, advantage }: { owner: Color; captured: PieceSymbol[]; advantage: number }) {
  const opp: Color = owner === 'w' ? 'b' : 'w'
  return (
    <div className="flex min-h-[1.75rem] items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full ring-1"
        style={
          owner === 'w'
            ? { background: '#e7eaf4', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }
            : { background: '#1c2030', boxShadow: '0 0 0 1px rgba(255,255,255,0.3)' }
        }
      />
      <div className="flex flex-wrap items-center gap-px">
        {sortPieces(captured).map((p, i) => (
          <img key={`${p}-${i}`} src={pieceSrc(opp, p)} alt={p} className="h-5 w-5" draggable={false} />
        ))}
      </div>
      {advantage > 0 && <span className="ml-auto text-xs font-semibold text-success">+{advantage}</span>}
    </div>
  )
}

export function Captured({ history }: { history: MoveRecord[] }) {
  const byWhite: PieceSymbol[] = []
  const byBlack: PieceSymbol[] = []
  for (const m of history) {
    if (!m.captured) continue
    ;(m.color === 'w' ? byWhite : byBlack).push(m.captured)
  }
  const diff = sum(byWhite) - sum(byBlack)

  if (byWhite.length === 0 && byBlack.length === 0) return null

  return (
    <div className="card flex flex-col gap-1 p-3">
      <Tray owner="w" captured={byWhite} advantage={diff} />
      <Tray owner="b" captured={byBlack} advantage={-diff} />
    </div>
  )
}
