import { cn } from '@/lib/cn'
import { Badge, Spinner } from '@/components/ui'
import type { ChessGameApi } from './useChessGame'
import type { GameOutcome } from './types'

export function outcomeText(outcome: GameOutcome, winnerLabel: string): string {
  switch (outcome) {
    case 'checkmate':
      return `将杀 — ${winnerLabel}获胜`
    case 'stalemate':
      return '逼和（无子可动）'
    case 'draw-repetition':
      return '和棋 — 三次重复局面'
    case 'draw-fifty':
      return '和棋 — 五十回合规则'
    case 'draw-insufficient':
      return '和棋 — 子力不足'
    case 'draw':
      return '和棋'
    default:
      return ''
  }
}

export function StatusBar({ api }: { api: ChessGameApi }) {
  const { turn, outcome, inCheck, isGameOver, aiThinking, mode, humanColor, engineFailed } = api
  const turnLabel = turn === 'w' ? '白方' : '黑方'
  const winnerLabel = turn === 'w' ? '黑方' : '白方' // 被将杀的是该走的一方

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'inline-block h-3.5 w-3.5 rounded-full ring-1',
              turn === 'w' ? 'bg-[#e7eaf4] ring-black/30' : 'bg-[#1c2030] ring-white/30',
            )}
          />
          <div>
            <p className="text-sm font-semibold">
              {isGameOver ? '对局结束' : `${turnLabel}行棋`}
            </p>
            <p className="text-xs text-faint">
              {mode === 'pvp' ? '双人对战' : `人机 · 你执${humanColor === 'w' ? '白' : '黑'}`}
            </p>
          </div>
        </div>

        {aiThinking && (
          <span className="flex items-center gap-2 text-xs text-accent">
            <Spinner size={16} /> AI 思考中
          </span>
        )}
        {!aiThinking && inCheck && !isGameOver && <Badge tone="danger">将军</Badge>}
      </div>

      {isGameOver && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-center text-sm font-medium text-cosmic">
          {outcomeText(outcome, winnerLabel)}
        </p>
      )}

      {engineFailed && (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
          AI 引擎不可用，已降级为手动续弈（可代双方走子）。
        </p>
      )}
    </div>
  )
}
