// Pure-frontend chess feature — shared types (no backend API).

export type Color = 'w' | 'b'

/** Single-char piece code; uppercase = white, lowercase = black. */
export type Piece =
  | 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'
  | 'k' | 'q' | 'r' | 'b' | 'n' | 'p'

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

/** [row, col] with row 0 = rank 8, col 0 = file a. */
export type Coord = [number, number]

export interface Move {
  from: Coord
  to: Coord
  /** Promotion piece code (color-cased) or null. */
  promotion: Piece | null
  /** Captured piece code, if any. */
  captured?: Piece | null
  enPassant?: boolean
  /** 'K' kingside / 'Q' queenside castle. */
  castling?: 'K' | 'Q'
  /** SAN, attached lazily before display. */
  san?: string
}

export type GameState =
  | 'playing'
  | 'checkmate'
  | 'stalemate'
  | 'repetition'
  | 'fifty'
  | 'insufficient'

export type GameMode = 'pvp' | 'pvai'

/** Plain serializable snapshot of a game (postable to the worker). */
export interface GameSnapshot {
  fen: string
  /** position-count map (FEN first-4-fields → count) for repetition. */
  positionCount: Record<string, number>
}

/** Worker request/response messages. */
export interface AiRequest {
  id: number
  kind: 'move' | 'hint'
  snapshot: GameSnapshot
  depth: number
}

export interface AiResponse {
  id: number
  kind: 'move' | 'hint'
  move: Move | null
}
