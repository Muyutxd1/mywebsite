// Self-contained chess engine ported from the legacy static implementation.
// FEN parse/serialize, full legal move generation (castling, en passant,
// promotion), check/checkmate/stalemate, threefold repetition, fifty-move,
// insufficient material, and SAN generation with disambiguation.

import type { Color, Coord, GameState, Move, Piece, PieceType } from './types'

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export const FILES = 'abcdefgh'

export const PIECE_UNICODE: Record<Piece, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
}

export const PIECE_VALUES: Record<PieceType, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
}

export function idx(r: number, c: number): number {
  return r * 8 + c
}

interface CastlingRights {
  K: boolean
  Q: boolean
  k: boolean
  q: boolean
}

interface SavedState {
  board: (Piece | null)[][]
  turn: Color
  castlingRights: CastlingRights
  enPassantTarget: Coord | null
  halfMoveClock: number
  fullMoveNumber: number
  positionCount: Record<string, number>
}

// Internal move shape carries undo bookkeeping for silent make/undo.
interface InternalMove extends Move {
  _prevBoard?: (Piece | null)[][]
  _prevCastling?: CastlingRights
  _prevEnPassant?: Coord | null
  _prevHalfMove?: number
}

export class ChessGame {
  board!: (Piece | null)[][]
  turn!: Color
  castlingRights!: CastlingRights
  enPassantTarget!: Coord | null
  halfMoveClock!: number
  fullMoveNumber!: number
  moveHistory: SavedState[] = []
  moveList: Move[] = []
  positionCount: Record<string, number> = {}

  constructor(fen?: string) {
    this.loadFEN(fen || INITIAL_FEN)
    this.moveHistory = []
    this.moveList = []
    this.positionCount = {}
    this.recordPosition()
  }

  clone(): ChessGame {
    const g = new ChessGame()
    g.board = this.board.map((row) => [...row])
    g.turn = this.turn
    g.castlingRights = { ...this.castlingRights }
    g.enPassantTarget = this.enPassantTarget ? [...this.enPassantTarget] : null
    g.halfMoveClock = this.halfMoveClock
    g.fullMoveNumber = this.fullMoveNumber
    g.moveHistory = this.moveHistory.map((h) => ({
      board: h.board.map((row) => [...row]),
      turn: h.turn,
      castlingRights: { ...h.castlingRights },
      enPassantTarget: h.enPassantTarget ? [...h.enPassantTarget] : null,
      halfMoveClock: h.halfMoveClock,
      fullMoveNumber: h.fullMoveNumber,
      positionCount: { ...h.positionCount },
    }))
    g.moveList = this.moveList.map((m) => ({ ...m }))
    g.positionCount = { ...this.positionCount }
    return g
  }

  loadFEN(fen: string): void {
    const parts = fen.split(' ')
    this.board = []
    for (const rowStr of parts[0].split('/')) {
      const row: (Piece | null)[] = []
      for (const ch of rowStr) {
        if (ch >= '1' && ch <= '8') {
          for (let i = 0; i < +ch; i++) row.push(null)
        } else {
          row.push(ch as Piece)
        }
      }
      this.board.push(row)
    }
    this.turn = parts[1] === 'w' ? 'w' : 'b'
    this.castlingRights = { K: false, Q: false, k: false, q: false }
    if (parts[2] && parts[2] !== '-') {
      for (const ch of parts[2]) {
        if (ch === 'K' || ch === 'Q' || ch === 'k' || ch === 'q') this.castlingRights[ch] = true
      }
    }
    this.enPassantTarget = !parts[3] || parts[3] === '-' ? null : this._parseSquare(parts[3])
    this.halfMoveClock = parseInt(parts[4]) || 0
    this.fullMoveNumber = parseInt(parts[5]) || 1
    this.moveHistory = []
    this.moveList = []
  }

  toFEN(): string {
    let fen = ''
    for (let r = 0; r < 8; r++) {
      let empty = 0
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === null) {
          empty++
        } else {
          if (empty > 0) {
            fen += empty
            empty = 0
          }
          fen += this.board[r][c]
        }
      }
      if (empty > 0) fen += empty
      if (r < 7) fen += '/'
    }
    fen += ' ' + this.turn
    const cr: string[] = []
    if (this.castlingRights.K) cr.push('K')
    if (this.castlingRights.Q) cr.push('Q')
    if (this.castlingRights.k) cr.push('k')
    if (this.castlingRights.q) cr.push('q')
    fen += ' ' + (cr.length ? cr.join('') : '-')
    fen += ' ' + (this.enPassantTarget ? this._squareStr(this.enPassantTarget) : '-')
    fen += ' ' + this.halfMoveClock
    fen += ' ' + this.fullMoveNumber
    return fen
  }

  _parseSquare(s: string): Coord {
    return [8 - parseInt(s[1]), FILES.indexOf(s[0])]
  }
  _squareStr(rc: Coord): string {
    return FILES[rc[1]] + (8 - rc[0])
  }

  getPiece(r: number, c: number): Piece | null {
    return this.board[r][c]
  }

  recordPosition(): void {
    const key = this.toFEN().split(' ').slice(0, 4).join(' ')
    this.positionCount[key] = (this.positionCount[key] || 0) + 1
  }

  // ---- Move generation ----

  _inBounds(r: number, c: number): boolean {
    return r >= 0 && r < 8 && c >= 0 && c < 8
  }

  _pieceType(p: Piece): PieceType {
    return p.toLowerCase() as PieceType
  }
  _pieceColor(p: Piece): Color {
    return p === p.toUpperCase() ? 'w' : 'b'
  }

  _pawnMoves(r: number, c: number, color: Color): Move[] {
    const moves: Move[] = []
    const dir = color === 'w' ? -1 : 1
    const startRow = color === 'w' ? 6 : 1
    const promoRow = color === 'w' ? 0 : 7

    const fr = r + dir
    if (this._inBounds(fr, c) && !this.board[fr][c]) {
      if (fr === promoRow) {
        for (const pp of ['Q', 'R', 'B', 'N']) {
          moves.push({ from: [r, c], to: [fr, c], promotion: (color === 'w' ? pp : pp.toLowerCase()) as Piece })
        }
      } else {
        moves.push({ from: [r, c], to: [fr, c], promotion: null })
      }
      const fr2 = r + 2 * dir
      if (r === startRow && !this.board[fr2][c]) {
        moves.push({ from: [r, c], to: [fr2, c], promotion: null })
      }
    }
    for (const dc of [-1, 1]) {
      const tc = c + dc
      if (!this._inBounds(fr, tc)) continue
      const target = this.board[fr][tc]
      if (target && this._pieceColor(target) !== color) {
        if (fr === promoRow) {
          for (const pp of ['Q', 'R', 'B', 'N']) {
            moves.push({
              from: [r, c],
              to: [fr, tc],
              promotion: (color === 'w' ? pp : pp.toLowerCase()) as Piece,
              captured: target,
            })
          }
        } else {
          moves.push({ from: [r, c], to: [fr, tc], promotion: null, captured: target })
        }
      }
      if (this.enPassantTarget && fr === this.enPassantTarget[0] && tc === this.enPassantTarget[1]) {
        moves.push({
          from: [r, c],
          to: [fr, tc],
          promotion: null,
          captured: (color === 'w' ? 'p' : 'P') as Piece,
          enPassant: true,
        })
      }
    }
    return moves
  }

  _knightMoves(r: number, c: number, color: Color): Move[] {
    const moves: Move[] = []
    const offsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1],
    ]
    for (const [dr, dc] of offsets) {
      const tr = r + dr
      const tc = c + dc
      if (!this._inBounds(tr, tc)) continue
      const target = this.board[tr][tc]
      if (!target || this._pieceColor(target) !== color) {
        moves.push({ from: [r, c], to: [tr, tc], promotion: null, captured: target || null })
      }
    }
    return moves
  }

  _slidingMoves(r: number, c: number, color: Color, dirs: number[][]): Move[] {
    const moves: Move[] = []
    for (const [dr, dc] of dirs) {
      for (let i = 1; i < 8; i++) {
        const tr = r + dr * i
        const tc = c + dc * i
        if (!this._inBounds(tr, tc)) break
        const target = this.board[tr][tc]
        if (!target) {
          moves.push({ from: [r, c], to: [tr, tc], promotion: null, captured: null })
        } else {
          if (this._pieceColor(target) !== color) {
            moves.push({ from: [r, c], to: [tr, tc], promotion: null, captured: target })
          }
          break
        }
      }
    }
    return moves
  }

  _bishopMoves(r: number, c: number, color: Color): Move[] {
    return this._slidingMoves(r, c, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]])
  }
  _rookMoves(r: number, c: number, color: Color): Move[] {
    return this._slidingMoves(r, c, color, [[-1, 0], [1, 0], [0, -1], [0, 1]])
  }
  _queenMoves(r: number, c: number, color: Color): Move[] {
    return this._slidingMoves(r, c, color, [
      [-1, -1], [-1, 1], [1, -1], [1, 1],
      [-1, 0], [1, 0], [0, -1], [0, 1],
    ])
  }

  _kingMoves(r: number, c: number, color: Color): Move[] {
    const moves: Move[] = []
    for (const [dr, dc] of [
      [-1, -1], [-1, 0], [-1, 1], [0, -1],
      [0, 1], [1, -1], [1, 0], [1, 1],
    ]) {
      const tr = r + dr
      const tc = c + dc
      if (!this._inBounds(tr, tc)) continue
      const target = this.board[tr][tc]
      if (!target || this._pieceColor(target) !== color) {
        moves.push({ from: [r, c], to: [tr, tc], promotion: null, captured: target || null })
      }
    }
    // Castling
    const row = color === 'w' ? 7 : 0
    if (r === row && c === 4) {
      const ksKey = color === 'w' ? 'K' : 'k'
      const rk = this.board[row][7]
      if (
        this.castlingRights[ksKey] &&
        !this.board[row][5] &&
        !this.board[row][6] &&
        rk &&
        this._pieceType(rk) === 'r' &&
        !this._isSquareAttacked(row, 4, color) &&
        !this._isSquareAttacked(row, 5, color) &&
        !this._isSquareAttacked(row, 6, color)
      ) {
        moves.push({ from: [r, c], to: [row, 6], promotion: null, captured: null, castling: 'K' })
      }
      const qsKey = color === 'w' ? 'Q' : 'q'
      const rq = this.board[row][0]
      if (
        this.castlingRights[qsKey] &&
        !this.board[row][1] &&
        !this.board[row][2] &&
        !this.board[row][3] &&
        rq &&
        this._pieceType(rq) === 'r' &&
        !this._isSquareAttacked(row, 4, color) &&
        !this._isSquareAttacked(row, 3, color) &&
        !this._isSquareAttacked(row, 2, color)
      ) {
        moves.push({ from: [r, c], to: [row, 2], promotion: null, captured: null, castling: 'Q' })
      }
    }
    return moves
  }

  _pseudoMovesFrom(r: number, c: number): Move[] {
    const piece = this.board[r][c]
    if (!piece) return []
    const color = this._pieceColor(piece)
    const type = this._pieceType(piece)
    switch (type) {
      case 'p': return this._pawnMoves(r, c, color)
      case 'n': return this._knightMoves(r, c, color)
      case 'b': return this._bishopMoves(r, c, color)
      case 'r': return this._rookMoves(r, c, color)
      case 'q': return this._queenMoves(r, c, color)
      case 'k': return this._kingMoves(r, c, color)
      default: return []
    }
  }

  _isSquareAttacked(r: number, c: number, myColor: Color): boolean {
    const enemy: Color = myColor === 'w' ? 'b' : 'w'
    for (let rr = 0; rr < 8; rr++) {
      for (let cc = 0; cc < 8; cc++) {
        const p = this.board[rr][cc]
        if (!p || this._pieceColor(p) !== enemy) continue
        const type = this._pieceType(p)
        const dr = r - rr
        const dc = c - cc
        switch (type) {
          case 'p': {
            const pDir = enemy === 'w' ? -1 : 1
            if (dr === pDir && Math.abs(dc) === 1) return true
            break
          }
          case 'n':
            if ((Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2)) return true
            break
          case 'b':
            if (Math.abs(dr) === Math.abs(dc) && dr !== 0) {
              if (this._clearPath(rr, cc, r, c)) return true
            }
            break
          case 'r':
            if ((dr === 0 || dc === 0) && (dr !== 0 || dc !== 0)) {
              if (this._clearPath(rr, cc, r, c)) return true
            }
            break
          case 'q':
            if ((Math.abs(dr) === Math.abs(dc) || dr === 0 || dc === 0) && (dr !== 0 || dc !== 0)) {
              if (this._clearPath(rr, cc, r, c)) return true
            }
            break
          case 'k':
            if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0)) return true
            break
        }
      }
    }
    return false
  }

  _clearPath(r1: number, c1: number, r2: number, c2: number): boolean {
    const dr = Math.sign(r2 - r1)
    const dc = Math.sign(c2 - c1)
    let r = r1 + dr
    let c = c1 + dc
    while (r !== r2 || c !== c2) {
      if (this.board[r][c]) return false
      r += dr
      c += dc
    }
    return true
  }

  isInCheck(color: Color): boolean {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === (color === 'w' ? 'K' : 'k')) {
          return this._isSquareAttacked(r, c, color)
        }
      }
    }
    return true
  }

  generateLegalMoves(color: Color): Move[] {
    const legal: Move[] = []
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c]
        if (!p || this._pieceColor(p) !== color) continue
        for (const move of this._pseudoMovesFrom(r, c)) {
          this._makeMoveSilent(move)
          if (!this.isInCheck(color)) legal.push(move)
          this._undoMoveSilent(move)
        }
      }
    }
    return legal
  }

  _makeMoveSilent(move: Move): void {
    const m = move as InternalMove
    const [fr, fc] = move.from
    const [tr, tc] = move.to
    m._prevBoard = this.board.map((row) => [...row])
    m._prevCastling = { ...this.castlingRights }
    m._prevEnPassant = this.enPassantTarget
    m._prevHalfMove = this.halfMoveClock

    const piece = this.board[fr][fc]!
    this.board[tr][tc] = move.promotion || piece
    this.board[fr][fc] = null

    if (move.enPassant) {
      const capturedRow = this._pieceColor(piece) === 'w' ? tr + 1 : tr - 1
      this.board[capturedRow][tc] = null
    }
    if (move.castling) {
      const row = tr
      if (move.castling === 'K') {
        this.board[row][5] = this.board[row][7]
        this.board[row][7] = null
      } else {
        this.board[row][3] = this.board[row][0]
        this.board[row][0] = null
      }
    }
  }

  _undoMoveSilent(move: Move): void {
    const m = move as InternalMove
    this.board = m._prevBoard!
    this.castlingRights = m._prevCastling!
    this.enPassantTarget = m._prevEnPassant!
    this.halfMoveClock = m._prevHalfMove!
  }

  makeMove(move: Move): void {
    const [fr, fc] = move.from
    const [tr, tc] = move.to
    const piece = this.board[fr][fc]!
    const color = this._pieceColor(piece)

    const prevState: SavedState = {
      board: this.board.map((row) => [...row]),
      turn: this.turn,
      castlingRights: { ...this.castlingRights },
      enPassantTarget: this.enPassantTarget,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber,
      positionCount: { ...this.positionCount },
    }

    this.board[tr][tc] = move.promotion || piece
    this.board[fr][fc] = null
    const captured = move.captured || (move.enPassant ? ((color === 'w' ? 'p' : 'P') as Piece) : null)

    if (move.enPassant) {
      const capturedRow = color === 'w' ? tr + 1 : tr - 1
      this.board[capturedRow][tc] = null
    }

    const row = tr
    if (move.castling === 'K') {
      this.board[row][5] = this.board[row][7]
      this.board[row][7] = null
    }
    if (move.castling === 'Q') {
      this.board[row][3] = this.board[row][0]
      this.board[row][0] = null
    }

    this.enPassantTarget = null
    if (this._pieceType(piece) === 'p' && Math.abs(tr - fr) === 2) {
      this.enPassantTarget = [Math.floor((fr + tr) / 2), fc]
    }

    if (piece === 'K') {
      this.castlingRights.K = false
      this.castlingRights.Q = false
    }
    if (piece === 'k') {
      this.castlingRights.k = false
      this.castlingRights.q = false
    }
    if (piece === 'R' && fr === 7 && fc === 0) this.castlingRights.Q = false
    if (piece === 'R' && fr === 7 && fc === 7) this.castlingRights.K = false
    if (piece === 'r' && fr === 0 && fc === 0) this.castlingRights.q = false
    if (piece === 'r' && fr === 0 && fc === 7) this.castlingRights.k = false
    if (tr === 7 && tc === 0) this.castlingRights.Q = false
    if (tr === 7 && tc === 7) this.castlingRights.K = false
    if (tr === 0 && tc === 0) this.castlingRights.q = false
    if (tr === 0 && tc === 7) this.castlingRights.k = false

    if (this._pieceType(piece) === 'p' || captured) {
      this.halfMoveClock = 0
    } else {
      this.halfMoveClock++
    }

    if (this.turn === 'b') this.fullMoveNumber++
    this.turn = this.turn === 'w' ? 'b' : 'w'

    this.moveHistory.push(prevState)
    this.moveList.push(move)
    this.recordPosition()
  }

  undoMove(): Move | null {
    if (this.moveHistory.length === 0) return null
    const prev = this.moveHistory.pop()!
    this.moveList.pop()

    const oldKey = this.toFEN().split(' ').slice(0, 4).join(' ')
    this.positionCount[oldKey] = Math.max(0, (this.positionCount[oldKey] || 0) - 1)

    this.board = prev.board
    this.turn = prev.turn
    this.castlingRights = prev.castlingRights
    this.enPassantTarget = prev.enPassantTarget
    this.halfMoveClock = prev.halfMoveClock
    this.fullMoveNumber = prev.fullMoveNumber
    this.positionCount = prev.positionCount

    return this.moveList[this.moveList.length - 1] || null
  }

  // ---- Game state checks ----

  getGameState(): GameState {
    const moves = this.generateLegalMoves(this.turn)
    if (moves.length === 0) {
      return this.isInCheck(this.turn) ? 'checkmate' : 'stalemate'
    }
    const key = this.toFEN().split(' ').slice(0, 4).join(' ')
    if (this.positionCount[key] >= 3) return 'repetition'
    if (this.halfMoveClock >= 100) return 'fifty'
    if (this._insufficientMaterial()) return 'insufficient'
    return 'playing'
  }

  _insufficientMaterial(): boolean {
    const pieces: Record<Color, PieceType[]> = { w: [], b: [] }
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c]
        if (!p) continue
        pieces[this._pieceColor(p)].push(this._pieceType(p))
      }
    }
    const w = pieces.w
    const b = pieces.b
    if (w.length === 1 && b.length === 1) return true
    if (w.length === 1 && b.length === 2 && (b.includes('b') || b.includes('n'))) return true
    if (b.length === 1 && w.length === 2 && (w.includes('b') || w.includes('n'))) return true
    if (w.length === 2 && b.length === 2 && w.includes('b') && b.includes('b')) {
      let wbSq: number | null = null
      let bbSq: number | null = null
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c]
          if (p === 'B') wbSq = (r + c) % 2
          if (p === 'b') bbSq = (r + c) % 2
        }
      }
      if (wbSq === bbSq) return true
    }
    return false
  }
}

// Compute SAN BEFORE the move is made (needs pre-move board state).
export function computeSAN(game: ChessGame, move: Move): string {
  if (move.castling === 'K') return 'O-O'
  if (move.castling === 'Q') return 'O-O-O'

  const [fr, fc] = move.from
  const [tr, tc] = move.to
  const piece = game.board[fr][fc]!
  const type = game._pieceType(piece)
  const color = game._pieceColor(piece)
  const isPawn = type === 'p'
  const captured = move.captured || move.enPassant

  const allLegal = game.generateLegalMoves(color)
  const ambiguous = allLegal.filter((m) => {
    const src = game.board[m.from[0]][m.from[1]]
    return (
      m.to[0] === tr &&
      m.to[1] === tc &&
      (m.from[0] !== fr || m.from[1] !== fc) &&
      src !== null &&
      game._pieceType(src) === type
    )
  })

  let notation = ''
  if (!isPawn) {
    notation += type.toUpperCase()
    if (ambiguous.length > 0) {
      const sameFile = ambiguous.some((m) => m.from[1] === fc)
      const sameRank = ambiguous.some((m) => m.from[0] === fr)
      if (!sameFile) {
        notation += FILES[fc]
      } else if (!sameRank) {
        notation += 8 - fr
      } else {
        notation += FILES[fc] + (8 - fr)
      }
    }
  }

  if (captured) {
    if (isPawn) notation += FILES[fc]
    notation += 'x'
  }

  notation += FILES[tc] + (8 - tr)

  if (move.promotion) {
    notation += '=' + move.promotion.toUpperCase()
  }

  game._makeMoveSilent(move)
  const enemyColor: Color = color === 'w' ? 'b' : 'w'
  if (game.isInCheck(enemyColor)) {
    const enemyMoves = game.generateLegalMoves(enemyColor)
    notation += enemyMoves.length === 0 ? '#' : '+'
  }
  game._undoMoveSilent(move)

  return notation
}
