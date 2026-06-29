// 中国象棋 — 共享类型（纯前端，自研规则引擎）。

/** 红 / 黑。红方先行，居棋盘下方（row 9 一侧）。 */
export type Color = 'r' | 'b'

/**
 * 棋子类型：
 * k 将/帅, a 士/仕, e 象/相, h 马, r 车, c 炮, p 兵/卒。
 */
export type PieceType = 'k' | 'a' | 'e' | 'h' | 'r' | 'c' | 'p'

export interface Piece {
  type: PieceType
  color: Color
}

/** [row, col]：row 0..9（0 = 顶部黑方底线），col 0..8（0 = 最左列）。 */
export type Coord = [number, number]

export interface Move {
  from: Coord
  to: Coord
  /** 被吃的子（生成时填充，便于评估/显示）。 */
  captured?: Piece | null
  /** 中文记谱（如“炮二平五”），落子前惰性计算。 */
  chinese?: string
}

export type GameOutcome =
  | 'playing'
  | 'checkmate' // 将死（被将且无解）
  | 'stalemate' // 困毙（无被将但无着可走）——象棋中同样判负
  | 'draw-repetition'

export type GameMode = 'pvp' | 'pvai'

/** 难度 → minimax 搜索深度。 */
export interface Level {
  id: string
  label: string
  depth: number
}

export const LEVELS: Level[] = [
  { id: 'beginner', label: '入门', depth: 1 },
  { id: 'easy', label: '简单', depth: 2 },
  { id: 'medium', label: '中等', depth: 3 },
  { id: 'hard', label: '困难', depth: 4 },
]

/** 工作线程消息。 */
export interface AiRequest {
  id: number
  fen: string
  depth: number
}

export interface AiResponse {
  id: number
  move: Move | null
}
