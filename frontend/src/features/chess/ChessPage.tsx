import { useEffect, useState } from 'react'
import { Card } from '@/components/ui'
import { Board } from './Board'
import { StatusBar } from './StatusBar'
import { Controls } from './Controls'
import { Captured } from './Captured'
import { MoveList } from './MoveList'
import { TransferPanel } from './TransferPanel'
import { GameOverDialog } from './GameOverDialog'
import { useChessGame } from './useChessGame'

export default function ChessPage() {
  const api = useChessGame()
  const [dismissed, setDismissed] = useState(false)

  // 新对局 / 局面变回进行中时，重新允许弹出结束对话框。
  useEffect(() => {
    if (!api.isGameOver) setDismissed(false)
  }, [api.isGameOver])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">Game · 棋局</p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          <span className="text-cosmic">♚ 国际象棋 ♔</span>
        </h1>
        <p className="mt-2 text-muted">
          拖拽或点击走子，与好友对弈或挑战 Stockfish 引擎。支持悔棋、提示、走法记录与 FEN/PGN 导入导出。
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">
        <Card className="flex justify-center self-center p-3 sm:p-4 lg:self-start">
          <Board
            board={api.board}
            orientation={api.orientation}
            sideToMove={api.turn}
            interactive={api.interactive}
            selected={api.selected}
            legalTargets={api.legalTargets}
            lastMove={api.lastMove}
            checkSquare={api.checkSquare}
            hint={api.hint}
            pendingPromotion={api.pendingPromotion}
            onSquareClick={api.onSquareClick}
            onDrop={api.onDrop}
            onPromote={api.resolvePromotion}
            onCancelPromotion={api.cancelPromotion}
          />
        </Card>

        <aside className="flex w-full flex-col gap-3 lg:w-72">
          <StatusBar api={api} />
          <Controls api={api} />
          <Captured history={api.history} />
          <MoveList history={api.history} />
          <TransferPanel api={api} />
        </aside>
      </div>

      <GameOverDialog
        open={api.isGameOver && !dismissed}
        outcome={api.outcome}
        turn={api.turn}
        onNewGame={() => {
          setDismissed(false)
          api.newGame()
        }}
        onClose={() => setDismissed(true)}
      />
    </div>
  )
}
