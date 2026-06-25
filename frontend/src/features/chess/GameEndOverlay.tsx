import { Button, Modal } from '@/components/ui'
import type { Color, GameState } from './types'

/** Maps a terminal game state to the overlay title + message (Chinese copy). */
function endCopy(state: GameState, turn: Color): { title: string; msg: string } | null {
  switch (state) {
    case 'checkmate': {
      const winner = turn === 'w' ? '黑方' : '白方'
      return { title: '将杀！', msg: `${winner}获胜！` }
    }
    case 'stalemate':
      return { title: '逼和！', msg: '无合法走法，平局' }
    case 'repetition':
      return { title: '三次重复局面', msg: '和棋' }
    case 'fifty':
      return { title: '50步规则', msg: '和棋' }
    case 'insufficient':
      return { title: '子力不足', msg: '和棋' }
    default:
      return null
  }
}

export function GameEndOverlay({
  state,
  turn,
  onNewGame,
  onClose,
}: {
  state: GameState
  turn: Color
  onNewGame: () => void
  onClose: () => void
}) {
  const copy = endCopy(state, turn)
  return (
    <Modal open={!!copy} onClose={onClose} className="max-w-sm text-center">
      {copy && (
        <div className="flex flex-col items-center gap-2 py-2">
          <h2 className="text-2xl font-bold text-cosmic">{copy.title}</h2>
          <p className="text-muted">{copy.msg}</p>
          <Button className="mt-4 min-w-36" onClick={onNewGame}>
            再来一局
          </Button>
        </div>
      )}
    </Modal>
  )
}
