// AI search Web Worker. Receives a serializable snapshot, rebuilds the game,
// runs minimax + alpha-beta, and posts back the chosen move. Keeps the UI
// thread free so it never freezes during search.

/// <reference lib="webworker" />

import { ChessGame } from './engine'
import { getBestMove } from './ai'
import type { AiRequest, AiResponse } from './types'

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { id, kind, snapshot, depth } = e.data
  const game = new ChessGame(snapshot.fen)
  // Restore repetition counts so the search can score draws correctly.
  game.positionCount = { ...snapshot.positionCount }

  const move = getBestMove(game, depth)
  const response: AiResponse = { id, kind, move }
  ;(self as unknown as Worker).postMessage(response)
}
