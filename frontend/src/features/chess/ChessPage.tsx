import { useEffect, useState } from 'react'
import { Card } from '@/components/ui'
import { ChessBoard } from './ChessBoard'
import { GameControls } from './GameControls'
import { StatusBar } from './StatusBar'
import { MoveList } from './MoveList'
import { PromotionModal } from './PromotionModal'
import { GameEndOverlay } from './GameEndOverlay'
import { useChessGame } from './useChessGame'

export default function ChessPage() {
  const api = useChessGame()
  const { state, mode, turn, moveList, promotion } = api

  // Allow the user to dismiss the end overlay without ending the game state.
  const [endDismissed, setEndDismissed] = useState(false)
  useEffect(() => {
    if (state === 'playing') setEndDismissed(false)
  }, [state])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">Game · 棋局</p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          <span className="text-cosmic">♚ 国际象棋 ♔</span>
        </h1>
        <p className="mt-2 text-muted">
          点击棋子查看合法走法，与好友对弈或挑战内置 AI（人机模式你执白先行）。
        </p>
      </header>

      <div className="flex flex-col items-start gap-6 lg:flex-row lg:justify-center">
        {/* Board */}
        <Card className="w-full max-w-fit self-center p-4 sm:p-5 lg:self-start">
          <ChessBoard api={api} />
        </Card>

        {/* Sidebar */}
        <aside className="flex w-full flex-col gap-3.5 lg:w-64">
          <StatusBar api={api} />
          <GameControls api={api} />
          <MoveList moves={moveList} turn={turn} />
        </aside>
      </div>

      <PromotionModal
        open={!!promotion}
        color={turn}
        onSelect={api.resolvePromotion}
        onCancel={api.cancelPromotion}
      />

      <GameEndOverlay
        state={endDismissed ? 'playing' : state}
        turn={turn}
        onNewGame={() => {
          setEndDismissed(false)
          api.newGame()
        }}
        onClose={() => setEndDismissed(true)}
      />

      {/* mode hint footnote */}
      <p className="mt-6 text-center text-xs text-faint">
        {mode === 'pvp' ? '当前：双人对战模式' : '当前：人机对战模式'}
      </p>
    </div>
  )
}
