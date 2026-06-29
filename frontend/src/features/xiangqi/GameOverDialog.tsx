import { Modal } from '@/components/ui'
import { outcomeText } from './StatusBar'
import type { Color, GameOutcome } from './types'

export function GameOverDialog({
  open,
  outcome,
  turn,
  onNewGame,
  onClose,
}: {
  open: boolean
  outcome: GameOutcome
  turn: Color
  onNewGame: () => void
  onClose: () => void
}) {
  const winnerLabel = turn === 'r' ? '黑方' : '红方'
  const isDraw = outcome === 'draw-repetition'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="对局结束"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-fg-soft hover:bg-surface-2"
          >
            查看棋盘
          </button>
          <button
            onClick={onNewGame}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-strong"
          >
            再来一局
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <span className="text-4xl">{isDraw ? '和' : '将'}</span>
        <p className="text-lg font-semibold text-cosmic">{outcomeText(outcome, winnerLabel)}</p>
      </div>
    </Modal>
  )
}
