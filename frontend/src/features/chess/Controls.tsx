import { Button, Select, Tabs } from '@/components/ui'
import { LEVELS } from './types'
import type { ChessGameApi } from './useChessGame'
import type { Color, GameMode } from './types'

const NewIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)
const UndoIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 5 5v1" />
  </svg>
)
const HintIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
  </svg>
)
const FlipIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
)

export function Controls({ api }: { api: ChessGameApi }) {
  const {
    mode, setMode, humanColor, setHumanColor, levelId, setLevel,
    newGame, undo, requestHint, flipBoard,
    aiThinking, history, isGameOver, interactive, engineFailed,
  } = api

  const canUndo = history.length > 0 && !aiThinking
  const canHint = interactive && !isGameOver && !engineFailed

  return (
    <div className="card flex flex-col gap-3 p-4">
      <Tabs<GameMode>
        tabs={[
          { value: 'pvp', label: '双人对战' },
          { value: 'pvai', label: '人机对战' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'pvai' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted">执棋</span>
            <Tabs<Color>
              tabs={[
                { value: 'w', label: '白（先手）' },
                { value: 'b', label: '黑（后手）' },
              ]}
              value={humanColor}
              onChange={setHumanColor}
            />
          </div>
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted">难度</span>
            <Select value={levelId} onChange={(e) => setLevel(e.target.value)} className="w-32">
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" size="sm" leftIcon={NewIcon} onClick={newGame}>
          新对局
        </Button>
        <Button variant="secondary" size="sm" leftIcon={UndoIcon} onClick={undo} disabled={!canUndo}>
          悔棋
        </Button>
        <Button variant="secondary" size="sm" leftIcon={HintIcon} onClick={requestHint} disabled={!canHint}>
          提示
        </Button>
        <Button variant="secondary" size="sm" leftIcon={FlipIcon} onClick={flipBoard}>
          翻转
        </Button>
      </div>
    </div>
  )
}
