import { useEffect, useState } from 'react'
import { Card } from '@/components/ui'
import { Board } from './Board'
import { StatusBar } from './StatusBar'
import { Controls } from './Controls'
import { MoveList } from './MoveList'
import { TransferPanel } from './TransferPanel'
import { GameOverDialog } from './GameOverDialog'
import { useXiangqiGame } from './useXiangqiGame'

export default function XiangqiPage() {
  const api = useXiangqiGame()
  const [dismissed, setDismissed] = useState(false)
  const over = api.outcome !== 'playing'

  useEffect(() => {
    if (!over) setDismissed(false)
  }, [over])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">Game · 棋局</p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          <span className="text-cosmic">楚河 · 汉界</span>
        </h1>
        <p className="mt-2 text-muted">
          中国象棋 · 拖拽或点击走子，与好友对弈或挑战内置 AI。支持悔棋、提示、中文记谱与 FEN 导入导出。
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">
        <Card className="flex w-full justify-center self-center p-3 sm:p-4 lg:w-[512px] lg:self-start">
          <Board
            board={api.board}
            orientation={api.orientation}
            sideToMove={api.turn}
            interactive={api.interactive}
            selected={api.selected}
            legalTargets={api.legalTargets}
            lastMove={api.lastMove}
            checkGeneral={api.checkGeneral}
            hint={api.hint}
            onPointClick={api.onPointClick}
            onDrop={api.onDrop}
          />
        </Card>

        <aside className="flex w-full flex-col gap-3 lg:w-72">
          <StatusBar api={api} />
          <Controls api={api} />
          <MoveList moveList={api.moveList} />
          <TransferPanel api={api} />
        </aside>
      </div>

      <GameOverDialog
        open={over && !dismissed}
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
