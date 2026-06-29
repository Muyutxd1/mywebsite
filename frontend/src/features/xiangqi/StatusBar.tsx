import { Badge, Spinner } from '@/components/ui'
import type { XiangqiApi } from './useXiangqiGame'
import type { GameOutcome } from './types'

export function outcomeText(outcome: GameOutcome, winnerLabel: string): string {
  switch (outcome) {
    case 'checkmate':
      return `绝杀 — ${winnerLabel}胜`
    case 'stalemate':
      return `困毙 — ${winnerLabel}胜`
    case 'draw-repetition':
      return '和棋 — 重复局面'
    default:
      return ''
  }
}

export function StatusBar({ api }: { api: XiangqiApi }) {
  const { turn, outcome, inCheck, aiThinking, mode, humanColor } = api
  const over = outcome !== 'playing'
  const turnLabel = turn === 'r' ? '红方' : '黑方'
  const winnerLabel = turn === 'r' ? '黑方' : '红方'

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ring-1"
            style={
              turn === 'r'
                ? { background: '#fbf2dd', color: '#c0392b', boxShadow: '0 0 0 1px rgba(122,90,50,0.5)' }
                : { background: '#fbf2dd', color: '#1f2430', boxShadow: '0 0 0 1px rgba(122,90,50,0.5)' }
            }
          >
            {turn === 'r' ? '帅' : '将'}
          </span>
          <div>
            <p className="text-sm font-semibold">{over ? '对局结束' : `${turnLabel}行棋`}</p>
            <p className="text-xs text-faint">
              {mode === 'pvp' ? '双人对战' : `人机 · 你执${humanColor === 'r' ? '红' : '黑'}`}
            </p>
          </div>
        </div>

        {aiThinking && (
          <span className="flex items-center gap-2 text-xs text-accent">
            <Spinner size={16} /> AI 思考中
          </span>
        )}
        {!aiThinking && inCheck && !over && <Badge tone="danger">将军</Badge>}
      </div>

      {over && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-center text-sm font-medium text-cosmic">
          {outcomeText(outcome, winnerLabel)}
        </p>
      )}
    </div>
  )
}
