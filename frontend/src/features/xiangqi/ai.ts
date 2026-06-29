// 中国象棋 AI：迭代加深 + alpha-beta + 空着裁剪 + 将军延伸 + 杀手/历史启发排序
// + 带应将的静态搜索。评估 = 子力 + 位置表（红方视角，红正黑负）。
import { XiangqiGame } from './engine'
import type { Color, Move, PieceType } from './types'

const MATE = 1_000_000
const OPP: Record<Color, Color> = { r: 'b', b: 'r' }

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

function hasMajorMinor(game: XiangqiGame, color: Color): boolean {
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = game.board[r][c]
      if (p && p.color === color && (p.type === 'r' || p.type === 'h' || p.type === 'c')) return true
    }
  }
  return false
}

// ---- 搜索状态（每次 getBestMove 重置） ----
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
let nodes = 0
let deadline = 0
let stopped = false
const history = new Int32Array(90 * 90)
let killers: (Move | null)[][] = []

const sq = (r: number, c: number) => r * 9 + c
const hidx = (m: Move) => sq(m.from[0], m.from[1]) * 90 + sq(m.to[0], m.to[1])
const sameMove = (a: Move, b: Move) =>
  a.from[0] === b.from[0] && a.from[1] === b.from[1] && a.to[0] === b.to[0] && a.to[1] === b.to[1]

function addKiller(ply: number, m: Move): void {
  const k = killers[ply] || (killers[ply] = [null, null])
  if (k[0] && sameMove(k[0], m)) return
  k[1] = k[0]
  k[0] = m
}

function orderMoves(game: XiangqiGame, moves: Move[], ply: number): Move[] {
  const k = killers[ply]
  const scored = moves.map((m) => {
    let s: number
    if (m.captured) {
      s = 1_000_000 + VALUE[m.captured.type] * 16 - VALUE[game.board[m.from[0]][m.from[1]]!.type]
    } else if (k && k[0] && sameMove(k[0], m)) {
      s = 900_000
    } else if (k && k[1] && sameMove(k[1], m)) {
      s = 800_000
    } else {
      s = history[hidx(m)]
    }
    return { m, s }
  })
  scored.sort((a, b) => b.s - a.s)
  return scored.map((x) => x.m)
}

function quiesce(game: XiangqiGame, alpha: number, beta: number, ply: number): number {
  if (stopped) return 0
  if ((++nodes & 2047) === 0 && now() > deadline) {
    stopped = true
    return 0
  }

  // 被将时必须搜全部应将着法（含非吃子），无着即被将杀。
  if (game.isInCheck(game.turn)) {
    const moves = game.generateLegalMoves(game.turn)
    if (moves.length === 0) return -MATE + ply
    if (ply >= 24) return evalForSide(game)
    let best = -Infinity
    for (const m of orderMoves(game, moves, ply)) {
      game.makeMove(m)
      const s = -quiesce(game, -beta, -alpha, ply + 1)
      game.undoMove()
      if (stopped) return 0
      if (s > best) best = s
      if (best > alpha) alpha = best
      if (alpha >= beta) break
    }
    return best
  }

  const standPat = evalForSide(game)
  if (ply >= 24) return standPat
  if (standPat >= beta) return beta
  if (standPat > alpha) alpha = standPat

  // 只搜吃子，按 MVV-LVA 排序。
  const caps = game
    .generateLegalMoves(game.turn)
    .filter((m) => m.captured)
    .sort((a, b) => VALUE[b.captured!.type] - VALUE[a.captured!.type])
  for (const m of caps) {
    game.makeMove(m)
    const s = -quiesce(game, -beta, -alpha, ply + 1)
    game.undoMove()
    if (stopped) return 0
    if (s >= beta) return beta
    if (s > alpha) alpha = s
  }
  return alpha
}

function negamax(game: XiangqiGame, depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
  if (stopped) return 0
  if ((++nodes & 2047) === 0 && now() > deadline) {
    stopped = true
    return 0
  }

  const inCheck = game.isInCheck(game.turn)
  if (inCheck) depth++ // 将军延伸

  if (depth <= 0) return quiesce(game, alpha, beta, ply)

  const moves = game.generateLegalMoves(game.turn)
  if (moves.length === 0) return -MATE + ply

  // 空着裁剪（非将军、有大子、非边缘深度）。
  if (allowNull && depth >= 3 && !inCheck && Math.abs(beta) < MATE - 1000 && hasMajorMinor(game, game.turn)) {
    const R = 2
    game.turn = OPP[game.turn]
    const s = -negamax(game, depth - 1 - R, -beta, -beta + 1, ply + 1, false)
    game.turn = OPP[game.turn]
    if (stopped) return 0
    if (s >= beta) return beta
  }

  let best = -Infinity
  for (const m of orderMoves(game, moves, ply)) {
    game.makeMove(m)
    const s = -negamax(game, depth - 1, -beta, -alpha, ply + 1, true)
    game.undoMove()
    if (stopped) return 0
    if (s > best) best = s
    if (best > alpha) alpha = best
    if (alpha >= beta) {
      if (!m.captured) {
        addKiller(ply, m)
        history[hidx(m)] += depth * depth
      }
      break
    }
  }
  return best
}

export interface SearchLimits {
  /** 最大迭代深度。 */
  maxDepth: number
  /** 思考时间预算（毫秒）。 */
  timeMs: number
}

/** 迭代加深搜索，返回当前行棋方的最佳着法；无着可走返回 null。 */
export function getBestMove(game: XiangqiGame, limits: SearchLimits): Move | null {
  const rootMoves = game.generateLegalMoves(game.turn)
  if (rootMoves.length === 0) return null

  nodes = 0
  stopped = false
  history.fill(0)
  killers = []
  deadline = now() + Math.max(50, limits.timeMs)

  let best: Move = rootMoves[0]
  let bestScore = 0

  for (let depth = 1; depth <= limits.maxDepth; depth++) {
    let alpha = -Infinity
    const beta = Infinity
    let curBest: Move | null = null
    let curScore = -Infinity

    // 上一深度的最佳着法优先，其余按启发排序。
    const ordered = orderMoves(game, rootMoves, 0)
    ordered.sort((a, b) => (sameMove(a, best) ? -1 : sameMove(b, best) ? 1 : 0))

    for (const m of ordered) {
      game.makeMove(m)
      const s = -negamax(game, depth - 1, -beta, -alpha, 1, true)
      game.undoMove()
      if (stopped) break
      if (s > curScore) {
        curScore = s
        curBest = m
      }
      if (s > alpha) alpha = s
    }

    if (stopped) break
    if (curBest) {
      best = curBest
      bestScore = curScore
    }
    if (Math.abs(bestScore) > MATE - 1000) break // 已找到杀
    if (now() > deadline) break
  }

  return best
}
