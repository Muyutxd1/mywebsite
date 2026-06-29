// 中国象棋 AI：negamax + alpha-beta + 静态搜索(吃子) + MVV-LVA 排序。
// 评估 = 子力 + 位置表（红方视角，红正黑负）。
import { XiangqiGame } from './engine'
import type { Move, PieceType } from './types'

const MATE = 1_000_000
const NODE_CAP = 2_000_000

export const VALUE: Record<PieceType, number> = {
  k: 60000,
  r: 900,
  h: 400,
  c: 450,
  e: 200,
  a: 200,
  p: 100,
}

// 位置表均按“红方视角”给出：row 0 在顶部（敌方底线），row 9 在底部（红方底线）。
// 黑方棋子取镜像 table[9 - r][c]。
const PST_PAWN = [
  [9, 9, 9, 11, 13, 11, 9, 9, 9],
  [19, 24, 34, 42, 44, 42, 34, 24, 19],
  [19, 24, 32, 37, 37, 37, 32, 24, 19],
  [19, 23, 27, 29, 30, 29, 27, 23, 19],
  [14, 18, 20, 27, 29, 27, 20, 18, 14],
  [7, 0, 13, 0, 16, 0, 13, 0, 7],
  [7, 0, 7, 0, 15, 0, 7, 0, 7],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
]
const PST_HORSE = [
  [0, 3, 6, 5, 0, 5, 6, 3, 0],
  [3, 6, 10, 10, 10, 10, 10, 6, 3],
  [5, 12, 13, 14, 13, 14, 13, 12, 5],
  [4, 10, 13, 16, 15, 16, 13, 10, 4],
  [3, 10, 12, 14, 14, 14, 12, 10, 3],
  [3, 8, 11, 12, 13, 12, 11, 8, 3],
  [2, 6, 9, 10, 10, 10, 9, 6, 2],
  [1, 4, 6, 8, 6, 8, 6, 4, 1],
  [0, 2, 4, 5, 4, 5, 4, 2, 0],
  [0, 0, 2, 3, 2, 3, 2, 0, 0],
]
const PST_CANNON = [
  [6, 4, 0, -2, -4, -2, 0, 4, 6],
  [2, 2, 0, -2, -2, -2, 0, 2, 2],
  [2, 2, 0, -3, -4, -3, 0, 2, 2],
  [0, 0, 0, 2, 3, 2, 0, 0, 0],
  [0, 0, 1, 2, 3, 2, 1, 0, 0],
  [0, 0, 1, 2, 3, 2, 1, 0, 0],
  [2, 0, 2, 2, 3, 2, 2, 0, 2],
  [2, 0, 2, 3, 4, 3, 2, 0, 2],
  [4, 2, 3, 4, 5, 4, 3, 2, 4],
  [6, 4, 3, 4, 5, 4, 3, 4, 6],
]
const PST_ROOK = [
  [14, 14, 12, 18, 16, 18, 12, 14, 14],
  [16, 20, 18, 24, 26, 24, 18, 20, 16],
  [12, 12, 12, 18, 18, 18, 12, 12, 12],
  [12, 18, 16, 22, 22, 22, 16, 18, 12],
  [12, 14, 12, 18, 18, 18, 12, 14, 12],
  [12, 16, 14, 20, 20, 20, 14, 16, 12],
  [6, 10, 8, 14, 14, 14, 8, 10, 6],
  [4, 8, 6, 14, 12, 14, 6, 8, 4],
  [8, 4, 8, 16, 8, 16, 8, 4, 8],
  [-2, 10, 6, 14, 12, 14, 6, 10, -2],
]

const PST: Partial<Record<PieceType, number[][]>> = {
  p: PST_PAWN,
  h: PST_HORSE,
  c: PST_CANNON,
  r: PST_ROOK,
}

/** 局面评估，红正黑负（绝对分）。 */
export function evaluate(game: XiangqiGame): number {
  let score = 0
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = game.board[r][c]
      if (!p) continue
      const base = VALUE[p.type]
      const table = PST[p.type]
      const pos = table ? table[p.color === 'r' ? r : 9 - r][c] : 0
      score += p.color === 'r' ? base + pos : -(base + pos)
    }
  }
  return score
}

function evalForSide(game: XiangqiGame): number {
  return game.turn === 'r' ? evaluate(game) : -evaluate(game)
}

function orderMoves(moves: Move[]): Move[] {
  return moves
    .map((m) => ({
      m,
      // MVV-LVA：优先吃大子、用小子吃
      s: m.captured ? VALUE[m.captured.type] * 10 - VALUE[game_pieceType(m)] : 0,
    }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m)
}

// 取走子方棋子类型（用于排序时的攻击者价值）。排序在 make 之前调用，故直接读 from。
let CURRENT: XiangqiGame
function game_pieceType(m: Move): PieceType {
  return CURRENT.board[m.from[0]][m.from[1]]?.type ?? 'p'
}

let nodes = 0

function quiesce(game: XiangqiGame, alpha: number, beta: number, ply: number): number {
  if (nodes > NODE_CAP) return evalForSide(game)

  // 被将时不能“按兵不动”：必须搜索全部应将着法（含非吃子），无着即被将杀。
  if (game.isInCheck(game.turn)) {
    const moves = game.generateLegalMoves(game.turn)
    if (moves.length === 0) return -MATE + ply
    if (ply >= 8) return evalForSide(game)
    let best = -Infinity
    for (const m of orderMoves(moves)) {
      nodes++
      game.makeMove(m)
      const score = -quiesce(game, -beta, -alpha, ply + 1)
      game.undoMove()
      if (score > best) best = score
      if (best > alpha) alpha = best
      if (alpha >= beta) break
    }
    return best
  }

  const standPat = evalForSide(game)
  if (ply >= 6) return standPat
  if (standPat >= beta) return beta
  if (standPat > alpha) alpha = standPat

  const captures = game.generateLegalMoves(game.turn).filter((m) => m.captured)
  for (const m of orderMoves(captures)) {
    nodes++
    game.makeMove(m)
    const score = -quiesce(game, -beta, -alpha, ply + 1)
    game.undoMove()
    if (score >= beta) return beta
    if (score > alpha) alpha = score
  }
  return alpha
}

function negamax(game: XiangqiGame, depth: number, alpha: number, beta: number, ply: number): number {
  if (nodes > NODE_CAP) return evalForSide(game)
  const moves = game.generateLegalMoves(game.turn)
  if (moves.length === 0) return -MATE + ply // 无着可走（将死/困毙）均判负
  if (depth <= 0) return quiesce(game, alpha, beta, ply)

  let best = -Infinity
  for (const m of orderMoves(moves)) {
    nodes++
    game.makeMove(m)
    const score = -negamax(game, depth - 1, -beta, -alpha, ply + 1)
    game.undoMove()
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

/** 返回当前行棋方的最佳着法（轻微随机以避免每局雷同）；无着可走返回 null。 */
export function getBestMove(game: XiangqiGame, depth: number): Move | null {
  CURRENT = game
  nodes = 0
  const moves = game.generateLegalMoves(game.turn)
  if (moves.length === 0) return null

  // 1) alpha-beta 找出最优着法（其分值是精确的 PV 值）。
  const ordered = orderMoves(moves)
  let alpha = -Infinity
  const beta = Infinity
  let bestScore = -Infinity
  let bestMove: Move = ordered[0]
  const rough: { m: Move; s: number }[] = []
  for (const m of ordered) {
    game.makeMove(m)
    const score = -negamax(game, depth - 1, -beta, -alpha, 1)
    game.undoMove()
    rough.push({ m, s: score })
    if (score > bestScore) {
      bestScore = score
      bestMove = m
    }
    if (score > alpha) alpha = score
  }

  // 2) 仅对“粗分（上界）接近最优”的少量候选用完整窗口复算精确分，
  //    构建随机池（含精确最优着），既有变化又不会误选劣着。
  const cands = rough.filter((x) => x.m !== bestMove && x.s >= bestScore - 15).slice(0, 6)
  const pool: Move[] = [bestMove]
  for (const { m } of cands) {
    game.makeMove(m)
    const s = -negamax(game, depth - 1, -Infinity, Infinity, 1)
    game.undoMove()
    if (s >= bestScore - 15) pool.push(m)
  }
  return pool[Math.floor(Math.random() * pool.length)]
}
