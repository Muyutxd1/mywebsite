// Minimax + alpha-beta AI with piece-square-table evaluation.
// Ported from the legacy static engine. White maximizes, black minimizes.

import { ChessGame, PIECE_VALUES, idx } from './engine'
import type { Move, PieceType } from './types'

// Piece-square tables (white's perspective, row 0 = rank8 ... row 7 = rank1).
const PST: Record<Exclude<PieceType, never>, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 10, 5, 10, 10, 5, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
}

const PST_K_END = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
]

export function evaluate(game: ChessGame): number {
  let score = 0
  let totalPieces = 0
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c]
      if (!p) continue
      totalPieces++
      const type = game._pieceType(p)
      const color = game._pieceColor(p)
      const sign = color === 'w' ? 1 : -1
      const sqIdx = color === 'w' ? idx(r, c) : idx(7 - r, 7 - c)
      score += sign * PIECE_VALUES[type]
      if (type === 'k' && totalPieces <= 10) {
        score += sign * PST_K_END[sqIdx]
      } else if (PST[type]) {
        score += sign * PST[type][sqIdx]
      }
    }
  }
  return score
}

function orderMoves(moves: Move[]): Move[] {
  return moves.sort((a, b) => {
    const scoreA =
      (a.captured ? PIECE_VALUES[a.captured.toLowerCase() as PieceType] * 10 + (a.promotion ? PIECE_VALUES[a.promotion.toLowerCase() as PieceType] : 0) : 0) +
      (a.promotion ? 900 : 0)
    const scoreB =
      (b.captured ? PIECE_VALUES[b.captured.toLowerCase() as PieceType] * 10 + (b.promotion ? PIECE_VALUES[b.promotion.toLowerCase() as PieceType] : 0) : 0) +
      (b.promotion ? 900 : 0)
    return scoreB - scoreA
  })
}

function minimax(game: ChessGame, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
  if (depth === 0) return evaluate(game)

  const state = game.getGameState()
  if (state === 'checkmate') {
    return isMaximizing ? -100000 - depth : 100000 + depth
  }
  if (state === 'stalemate' || state === 'repetition' || state === 'fifty' || state === 'insufficient') {
    return 0
  }

  const color = game.turn
  const moves = orderMoves(game.generateLegalMoves(color))

  if (isMaximizing) {
    let maxEval = -Infinity
    for (const move of moves) {
      game.makeMove(move)
      const evalScore = minimax(game, depth - 1, alpha, beta, false)
      game.undoMove()
      maxEval = Math.max(maxEval, evalScore)
      alpha = Math.max(alpha, evalScore)
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const move of moves) {
      game.makeMove(move)
      const evalScore = minimax(game, depth - 1, alpha, beta, true)
      game.undoMove()
      minEval = Math.min(minEval, evalScore)
      beta = Math.min(beta, evalScore)
      if (beta <= alpha) break
    }
    return minEval
  }
}

export function getBestMove(game: ChessGame, depth: number): Move | null {
  const color = game.turn
  const moves = orderMoves(game.generateLegalMoves(color))
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]

  const isMax = color === 'w'
  let bestMove = moves[0]
  let bestScore = isMax ? -Infinity : Infinity

  for (const move of moves) {
    game.makeMove(move)
    const score = minimax(game, depth - 1, -Infinity, Infinity, !isMax)
    game.undoMove()
    if (isMax ? score > bestScore : score < bestScore) {
      bestScore = score
      bestMove = move
    }
  }
  return bestMove
}
