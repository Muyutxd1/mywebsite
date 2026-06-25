import { cn } from '@/lib/cn'
import { Spinner } from '@/components/ui'
import type { ChessGameApi } from './useChessGame'

export function StatusBar({ api }: { api: ChessGameApi }) {
  const { state, turn, inCheck, aiThinking } = api

  if (aiThinking) {
    return (
      <div className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm font-semibold text-accent">
        <Spinner size={16} />
        AI 思考中…
      </div>
    )
  }

  let text = ''
  let tone = 'text-fg'
  const turnLabel = turn === 'w' ? '白方' : '黑方'

  switch (state) {
    case 'checkmate': {
      const winner = turn === 'w' ? '黑方' : '白方'
      text = `🏆 将杀！${winner}获胜`
      tone = 'text-gold'
      break
    }
    case 'stalemate':
      text = '🤝 逼和！平局'
      tone = 'text-cyan'
      break
    case 'repetition':
      text = '🔄 三次重复局面 — 和棋'
      tone = 'text-cyan'
      break
    case 'fifty':
      text = '📜 50步规则 — 和棋'
      tone = 'text-cyan'
      break
    case 'insufficient':
      text = '⚖️ 子力不足 — 和棋'
      tone = 'text-cyan'
      break
    default:
      text = `${turnLabel}走子${inCheck ? ' [将军！]' : ''}`
      tone = inCheck ? 'text-danger' : 'text-fg'
  }

  return (
    <div
      className={cn(
        'flex min-h-10 items-center justify-center rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-center text-sm font-semibold',
        tone,
      )}
    >
      {text}
    </div>
  )
}
