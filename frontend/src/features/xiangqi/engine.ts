// 中国象棋规则引擎（自研，零依赖）。
// 棋盘 10 行 × 9 列：row 0 在顶部（黑方底线），row 9 在底部（红方底线）；红方先行。
import type { Color, Coord, GameOutcome, Move, Piece, PieceType } from './types'

export const ROWS = 10
export const COLS = 9

const OPP: Record<Color, Color> = { r: 'b', b: 'r' }

// FEN 字母 ↔ 类型（象=b, 马=n，其余同名）。
const TYPE_TO_FEN: Record<PieceType, string> = { k: 'k', a: 'a', e: 'b', h: 'n', r: 'r', c: 'c', p: 'p' }
const FEN_TO_TYPE: Record<string, PieceType> = { k: 'k', a: 'a', b: 'e', n: 'h', r: 'r', c: 'c', p: 'p' }

export const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w'

function inBoard(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS
}

/** 是否在 color 一方的九宫内。 */
function inPalace(r: number, c: number, color: Color): boolean {
  if (c < 3 || c > 5) return false
  return color === 'r' ? r >= 7 && r <= 9 : r >= 0 && r <= 2
}

/** 象/相是否在己方半场（不可过河）。红：row>=5；黑：row<=4。 */
function ownHalf(r: number, color: Color): boolean {
  return color === 'r' ? r >= 5 : r <= 4
}

/** 兵/卒是否已过河。红向上：row<=4；黑向下：row>=5。 */
function pawnCrossed(r: number, color: Color): boolean {
  return color === 'r' ? r <= 4 : r >= 5
}

interface HistoryEntry {
  from: Coord
  to: Coord
  piece: Piece
  captured: Piece | null
}

export class XiangqiGame {
  board: (Piece | null)[][]
  turn: Color
  history: HistoryEntry[] = []

  constructor(fen: string = START_FEN) {
    const { board, turn } = XiangqiGame.parseFEN(fen)
    this.board = board
    this.turn = turn
  }

  clone(): XiangqiGame {
    const g = new XiangqiGame(this.toFEN())
    return g
  }

  get(r: number, c: number): Piece | null {
    return inBoard(r, c) ? this.board[r][c] : null
  }

  // ---- FEN ----

  static parseFEN(fen: string): { board: (Piece | null)[][]; turn: Color } {
    const parts = fen.trim().split(/\s+/)
    const rows = parts[0].split('/')
    if (rows.length !== ROWS) throw new Error('FEN 行数不正确')
    const board: (Piece | null)[][] = []
    for (let r = 0; r < ROWS; r++) {
      const line = rows[r]
      const cells: (Piece | null)[] = []
      for (const ch of line) {
        if (ch >= '1' && ch <= '9') {
          for (let i = 0; i < Number(ch); i++) cells.push(null)
        } else {
          const lower = ch.toLowerCase()
          const type = FEN_TO_TYPE[lower]
          if (!type) throw new Error(`FEN 非法字符: ${ch}`)
          cells.push({ type, color: ch === lower ? 'b' : 'r' })
        }
      }
      if (cells.length !== COLS) throw new Error('FEN 列数不正确')
      board.push(cells)
    }
    const turnField = (parts[1] ?? 'w').toLowerCase()
    const turn: Color = turnField === 'b' ? 'b' : 'r' // 'w'/'r' = 红
    return { board, turn }
  }

  toFEN(): string {
    const rows: string[] = []
    for (let r = 0; r < ROWS; r++) {
      let line = ''
      let empty = 0
      for (let c = 0; c < COLS; c++) {
        const p = this.board[r][c]
        if (!p) {
          empty++
        } else {
          if (empty) {
            line += empty
            empty = 0
          }
          const letter = TYPE_TO_FEN[p.type]
          line += p.color === 'r' ? letter.toUpperCase() : letter
        }
      }
      if (empty) line += empty
      rows.push(line)
    }
    return `${rows.join('/')} ${this.turn === 'r' ? 'w' : 'b'}`
  }

  /** 用于重复局面判定的键（局面 + 行棋方）。 */
  positionKey(): string {
    return this.toFEN()
  }

  // ---- 着法生成 ----

  /** 某格棋子的伪合法着法（不过滤“送将”）。 */
  pieceMoves(r: number, c: number): Move[] {
    const piece = this.board[r][c]
    if (!piece) return []
    const { type, color } = piece
    const out: Move[] = []
    const add = (tr: number, tc: number) => {
      if (!inBoard(tr, tc)) return
      const t = this.board[tr][tc]
      if (t && t.color === color) return
      out.push({ from: [r, c], to: [tr, tc], captured: t ?? null })
    }

    switch (type) {
      case 'k': {
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (inPalace(r + dr, c + dc, color)) add(r + dr, c + dc)
        }
        break
      }
      case 'a': {
        for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          if (inPalace(r + dr, c + dc, color)) add(r + dr, c + dc)
        }
        break
      }
      case 'e': {
        for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
          const tr = r + dr
          const tc = c + dc
          if (!inBoard(tr, tc) || !ownHalf(tr, color)) continue
          if (this.board[r + dr / 2][c + dc / 2]) continue // 塞象眼
          add(tr, tc)
        }
        break
      }
      case 'h': {
        const deltas = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]
        for (const [dr, dc] of deltas) {
          const tr = r + dr
          const tc = c + dc
          if (!inBoard(tr, tc)) continue
          const legr = r + (Math.abs(dr) === 2 ? dr / 2 : 0)
          const legc = c + (Math.abs(dc) === 2 ? dc / 2 : 0)
          if (this.board[legr][legc]) continue // 蹩马腿
          add(tr, tc)
        }
        break
      }
      case 'r': {
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let tr = r + dr
          let tc = c + dc
          while (inBoard(tr, tc)) {
            const t = this.board[tr][tc]
            if (!t) {
              out.push({ from: [r, c], to: [tr, tc], captured: null })
            } else {
              if (t.color !== color) out.push({ from: [r, c], to: [tr, tc], captured: t })
              break
            }
            tr += dr
            tc += dc
          }
        }
        break
      }
      case 'c': {
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let tr = r + dr
          let tc = c + dc
          // 第一阶段：未越子，沿空格平移（不可吃子）
          while (inBoard(tr, tc) && !this.board[tr][tc]) {
            out.push({ from: [r, c], to: [tr, tc], captured: null })
            tr += dr
            tc += dc
          }
          // 命中炮架后，越过它寻找第一个棋子
          tr += dr
          tc += dc
          while (inBoard(tr, tc)) {
            const t = this.board[tr][tc]
            if (t) {
              if (t.color !== color) out.push({ from: [r, c], to: [tr, tc], captured: t })
              break
            }
            tr += dr
            tc += dc
          }
        }
        break
      }
      case 'p': {
        const df = color === 'r' ? -1 : 1
        add(r + df, c)
        if (pawnCrossed(r, color)) {
          add(r, c - 1)
          add(r, c + 1)
        }
        break
      }
    }
    return out
  }

  generatePseudoMoves(color: Color): Move[] {
    const out: Move[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.board[r][c]
        if (p && p.color === color) out.push(...this.pieceMoves(r, c))
      }
    }
    return out
  }

  generateLegalMoves(color: Color): Move[] {
    const out: Move[] = []
    for (const m of this.generatePseudoMoves(color)) {
      this.makeMove(m)
      if (!this.isInCheck(color)) out.push(m)
      this.undoMove()
    }
    return out
  }

  findGeneral(color: Color): Coord | null {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.board[r][c]
        if (p && p.type === 'k' && p.color === color) return [r, c]
      }
    }
    return null
  }

  /** color 一方是否被将（含白脸将/对脸）。 */
  isInCheck(color: Color): boolean {
    const pos = this.findGeneral(color)
    if (!pos) return true
    return this.isAttacked(pos[0], pos[1], color)
  }

  /** (r,c) 处 color 方的棋子是否被对方攻击（反向射线检测，含飞将）。 */
  isAttacked(r: number, c: number, color: Color): boolean {
    const enemy = OPP[color]

    // 车 / 炮 / 飞将：四个方向
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let tr = r + dr
      let tc = c + dc
      // 找第一个子（炮架/直接攻击者）
      while (inBoard(tr, tc) && !this.board[tr][tc]) {
        tr += dr
        tc += dc
      }
      if (inBoard(tr, tc)) {
        const first = this.board[tr][tc]!
        if (first.color === enemy) {
          if (first.type === 'r') return true // 车
          if (first.type === 'k' && dc === 0) return true // 飞将（同列对脸）
        }
        // 炮：越过第一个子继续找第二个
        let sr = tr + dr
        let sc = tc + dc
        while (inBoard(sr, sc) && !this.board[sr][sc]) {
          sr += dr
          sc += dc
        }
        if (inBoard(sr, sc)) {
          const second = this.board[sr][sc]!
          if (second.color === enemy && second.type === 'c') return true
        }
      }
    }

    // 马（注意蹩马腿在马的落点一侧）
    for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
      const hr = r + dr
      const hc = c + dc
      if (!inBoard(hr, hc)) continue
      const p = this.board[hr][hc]
      if (!p || p.color !== enemy || p.type !== 'h') continue
      // 这匹马从 (hr,hc) 跳到 (r,c)，其马腿相对于马的落点
      const legr = hr + (Math.abs(dr) === 2 ? -dr / 2 : 0)
      const legc = hc + (Math.abs(dc) === 2 ? -dc / 2 : 0)
      if (!this.board[legr][legc]) return true
    }

    // 兵 / 卒
    const ef = enemy === 'r' ? -1 : 1 // 敌兵前进方向
    // 正前方：敌兵在 (r - ef, c) 前进可达 (r,c)
    if (inBoard(r - ef, c)) {
      const p = this.board[r - ef][c]
      if (p && p.color === enemy && p.type === 'p') return true
    }
    // 横向：同排相邻、且已过河的敌兵
    for (const dc of [-1, 1]) {
      if (!inBoard(r, c + dc)) continue
      const p = this.board[r][c + dc]
      if (p && p.color === enemy && p.type === 'p' && pawnCrossed(r, enemy)) return true
    }

    return false
  }

  // ---- 落子 / 悔棋 ----

  makeMove(move: Move): void {
    const [r1, c1] = move.from
    const [r2, c2] = move.to
    const piece = this.board[r1][c1]!
    const captured = this.board[r2][c2]
    this.history.push({ from: [r1, c1], to: [r2, c2], piece, captured })
    this.board[r2][c2] = piece
    this.board[r1][c1] = null
    this.turn = OPP[this.turn]
  }

  undoMove(): void {
    const h = this.history.pop()
    if (!h) return
    this.board[h.from[0]][h.from[1]] = h.piece
    this.board[h.to[0]][h.to[1]] = h.captured
    this.turn = OPP[this.turn]
  }

  /** 当前行棋方的对局结果（不含重复局面，由上层判定）。 */
  getOutcome(): GameOutcome {
    const legal = this.generateLegalMoves(this.turn)
    if (legal.length === 0) return this.isInCheck(this.turn) ? 'checkmate' : 'stalemate'
    return 'playing'
  }
}

// ---- 中文记谱 ----

const PIECE_NAME: Record<Color, Record<PieceType, string>> = {
  r: { k: '帅', a: '仕', e: '相', h: '马', r: '车', c: '炮', p: '兵' },
  b: { k: '将', a: '士', e: '象', h: '马', r: '车', c: '炮', p: '卒' },
}
const RED_DIGITS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const BLACK_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

function fileLabel(color: Color, col: number): string {
  // 红：从右到左 一..九（右侧 = col 8）；黑：从右到左 1..9（右侧 = col 0）
  return color === 'r' ? RED_DIGITS[8 - col] : BLACK_DIGITS[col]
}
function numLabel(color: Color, n: number): string {
  return color === 'r' ? RED_DIGITS[n - 1] : BLACK_DIGITS[n - 1]
}

/** 计算一步棋的中文记谱（须在落子前、用当前局面调用）。 */
export function computeChinese(game: XiangqiGame, move: Move): string {
  const [r1, c1] = move.from
  const [r2, c2] = move.to
  const piece = game.board[r1][c1]
  if (!piece) return ''
  const { color, type } = piece
  const name = PIECE_NAME[color][type]

  // 纵向方向：红前进 = 行减小；黑前进 = 行增大
  const forward = color === 'r' ? r2 < r1 : r2 > r1

  // 同列同类子 → 用 前/后(/中) 而非纵线号
  const sameCol: number[] = []
  for (let r = 0; r < ROWS; r++) {
    const p = game.board[r][c1]
    if (p && p.color === color && p.type === type) sameCol.push(r)
  }

  let prefix: string
  if (sameCol.length >= 2) {
    // 越靠近敌方越“前”：红 = 行小者前；黑 = 行大者前
    const ordered = [...sameCol].sort((a, b) => (color === 'r' ? a - b : b - a))
    const idx = ordered.indexOf(r1)
    let pos: string
    if (ordered.length === 2) pos = idx === 0 ? '前' : '后'
    else if (ordered.length === 3) pos = ['前', '中', '后'][idx]
    else pos = numLabel(color, idx + 1)
    // 若同色同类的“叠子”出现在不止一列，用纵线号限定以消歧。
    let pileFiles = 0
    for (let col = 0; col < COLS; col++) {
      let cnt = 0
      for (let r = 0; r < ROWS; r++) {
        const p = game.board[r][col]
        if (p && p.color === color && p.type === type) cnt++
      }
      if (cnt >= 2) pileFiles++
    }
    prefix = (pileFiles > 1 ? fileLabel(color, c1) : '') + pos + name
  } else {
    prefix = name + fileLabel(color, c1)
  }

  let action: string
  if (r1 === r2) {
    action = '平' + fileLabel(color, c2)
  } else {
    const dir = forward ? '进' : '退'
    if (c1 === c2) {
      action = dir + numLabel(color, Math.abs(r2 - r1)) // 直行：步数
    } else {
      action = dir + fileLabel(color, c2) // 走斜线的子：目标纵线
    }
  }
  return prefix + action
}
