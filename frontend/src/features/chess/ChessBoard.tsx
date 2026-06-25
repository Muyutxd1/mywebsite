import { Square } from './Square'
import { FileLabels, RankLabels } from './BoardCoordinates'
import type { ChessGameApi } from './useChessGame'

function eq(a: { from: [number, number]; to: [number, number] } | null, r: number, c: number): boolean {
  if (!a) return false
  return (a.from[0] === r && a.from[1] === c) || (a.to[0] === r && a.to[1] === c)
}

export function ChessBoard({ api }: { api: ChessGameApi }) {
  const { board, selected, legalTargets, hint, lastMove, turn, inCheck, state } = api
  const kingChar = turn === 'w' ? 'K' : 'k'
  const showCheck = inCheck && (state === 'playing' || state === 'checkmate')

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-stretch">
        <RankLabels />
        <div
          className="grid aspect-square w-[min(480px,calc(100vw-3rem))] grid-cols-8 grid-rows-8 overflow-hidden rounded-md border-[3px] border-[#5a4632] shadow-[var(--shadow-card)]"
        >
          {board.map((row, r) =>
            row.map((piece, c) => {
              const index = r * 8 + c
              const target = legalTargets.find((m) => m.to[0] === r && m.to[1] === c)
              const isCheckSq = showCheck && piece === kingChar
              return (
                <Square
                  key={index}
                  index={index}
                  r={r}
                  c={c}
                  piece={piece}
                  isLight={(r + c) % 2 === 0}
                  isSelected={!!selected && selected[0] === r && selected[1] === c}
                  isLegal={!!target}
                  isCapture={!!(target && (target.captured || target.enPassant))}
                  isLastMove={eq(lastMove, r, c)}
                  isCheck={isCheckSq}
                  isHintFrom={!!hint && hint.from[0] === r && hint.from[1] === c}
                  isHintTo={!!hint && hint.to[0] === r && hint.to[1] === c}
                  onClick={api.onSquareClick}
                />
              )
            }),
          )}
        </div>
      </div>
      {/* spacer to align file labels under board (skip the rank gutter) */}
      <div className="flex w-[min(480px,calc(100vw-3rem))] pl-[calc(0.75rem)]">
        <FileLabels />
      </div>
    </div>
  )
}
