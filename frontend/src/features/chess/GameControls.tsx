import { Button, Select } from '@/components/ui'
import type { ChessGameApi } from './useChessGame'

export function GameControls({ api }: { api: ChessGameApi }) {
  const { mode, difficulty, aiThinking, canUndo, state } = api
  const gameOver = state !== 'playing'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={api.newGame}>
          新局
        </Button>
        <Button variant="secondary" className="flex-1" onClick={api.undo} disabled={aiThinking || !canUndo}>
          悔棋
        </Button>
      </div>

      <Button variant="secondary" onClick={api.toggleMode} disabled={aiThinking}>
        {mode === 'pvp' ? '模式：双人对战' : '模式：人机对战'}
      </Button>

      {mode === 'pvai' && (
        <>
          <Button variant="gold" onClick={api.showHint} disabled={aiThinking || gameOver}>
            💡 走法提示
          </Button>
          <Select value={difficulty} onChange={(e) => api.setDifficulty(e.target.value)} disabled={aiThinking}>
            <option value="1">AI 难度：简单</option>
            <option value="2">AI 难度：中等</option>
            <option value="3">AI 难度：困难</option>
          </Select>
        </>
      )}
    </div>
  )
}
