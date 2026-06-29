// 国际象棋功能 — 共享类型。
// 规则引擎由 chess.js 提供，这里复用它的核心类型并补充一些 UI 用类型。
import type { Color, PieceSymbol, Square } from 'chess.js'

export type { Color, PieceSymbol, Square }

/** 棋盘单格上的棋子（即 chess.js `board()` 的元素）。 */
export interface BoardPiece {
  square: Square
  type: PieceSymbol
  color: Color
}

/** 对局模式：双人 / 人机。 */
export type GameMode = 'pvp' | 'pvai'

/** 对局结束原因（playing 表示进行中）。 */
export type GameOutcome =
  | 'playing'
  | 'checkmate'
  | 'stalemate'
  | 'draw-repetition'
  | 'draw-fifty'
  | 'draw-insufficient'
  | 'draw'

/** 一步棋的展示用快照（来自 chess.js verbose move）。 */
export interface MoveRecord {
  san: string
  from: Square
  to: Square
  color: Color
  piece: PieceSymbol
  captured?: PieceSymbol
  promotion?: PieceSymbol
}

/** 当前选中棋子可走到的目标格（capture 用于区分实心点 / 吃子环）。 */
export interface LegalTarget {
  square: Square
  capture: boolean
}

/** 升变选择的棋子类型。 */
export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

/** 难度等级：映射到 Stockfish 的技能等级与思考时长。 */
export interface Level {
  id: string
  label: string
  /** Stockfish `Skill Level`（0–20）。 */
  skill: number
  /** 单步思考时长（毫秒）。 */
  movetime: number
}

export const LEVELS: Level[] = [
  { id: 'beginner', label: '入门', skill: 0, movetime: 200 },
  { id: 'easy', label: '简单', skill: 3, movetime: 300 },
  { id: 'medium', label: '中等', skill: 8, movetime: 600 },
  { id: 'hard', label: '困难', skill: 14, movetime: 1000 },
  { id: 'master', label: '大师', skill: 20, movetime: 1500 },
]
