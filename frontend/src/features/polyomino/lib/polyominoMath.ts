/**
 * Polyomino transform / board engine — PURE TypeScript (no React).
 *
 * Ported VERBATIM from _legacy/static/js/polyomino-studio.js so that all
 * geometry, coordinate conventions, transform order, and saved data stay
 * byte-compatible with the legacy localStorage shapes.
 *
 *  - Coordinates are [row, col] pairs.
 *  - rotate90: [r,c] -> [c,-r] then normalize.
 *  - getTransformedCoords transform order: flipH -> flipV -> rotate N.
 */

export type Coord = [number, number]

/** Piece: { id, name, shape:[[r,c],...], color } — EXACT legacy shape. */
export interface Piece {
  id: string
  name: string
  shape: Coord[]
  color: string
}

/** Placement — EXACT legacy shape. */
export interface Placement {
  pieceId: string
  originR: number
  originC: number
  rotation: number // 0-3
  flipH: boolean
  flipV: boolean
}

export interface BoardState {
  rows: number
  cols: number
  placements: Placement[]
}

export interface ActiveSelection {
  pieceId: string
  rotation: number
  flipH: boolean
  flipV: boolean
}

export const STORAGE_KEY_PIECES = 'polyomino_pieces'
export const STORAGE_KEY_BOARD = 'polyomino_board_session'

export const DEFAULT_PALETTE = [
  '#FF6B6B', '#FF8E53', '#FFD93D', '#6BCB77', '#4D96FF',
  '#9B59B6', '#FF6FB7', '#00D2D3', '#F368E0', '#FF9FF3',
  '#54A0FF', '#5F27CD', '#01A3A4', '#FECA57', '#FF6348',
  '#7BED9F', '#70A1FF', '#FFA502', '#2ED573', '#FF4757',
]

export const DEFAULT_PIECES: Piece[] = [
  { id: 'builtin_monomino', name: '单体 (1×1)', shape: [[0, 0]], color: '#FF6B6B' },
  { id: 'builtin_domino', name: '多米诺 (1×2)', shape: [[0, 0], [0, 1]], color: '#4D96FF' },
  { id: 'builtin_L_tromino', name: 'L-三格', shape: [[0, 0], [1, 0], [2, 0], [2, 1]], color: '#6BCB77' },
  { id: 'builtin_I_tromino', name: 'I-三格', shape: [[0, 0], [1, 0], [2, 0]], color: '#FF8E53' },
  { id: 'builtin_T_tetromino', name: 'T-四格', shape: [[0, 0], [0, 1], [0, 2], [1, 1]], color: '#9B59B6' },
  { id: 'builtin_Z_tetromino', name: 'Z-四格', shape: [[0, 0], [0, 1], [1, 1], [1, 2]], color: '#FFD93D' },
  { id: 'builtin_L_tetromino', name: 'L-四格', shape: [[0, 0], [1, 0], [2, 0], [2, 1]], color: '#FF6FB7' },
  { id: 'builtin_O_tetromino', name: '方块 (2×2)', shape: [[0, 0], [0, 1], [1, 0], [1, 1]], color: '#00D2D3' },
]

/* ── TRANSFORM MATH ── */

export function normalizeCoords(coords: Coord[]): Coord[] {
  if (coords.length === 0) return []
  const minR = Math.min(...coords.map(([r]) => r))
  const minC = Math.min(...coords.map(([, c]) => c))
  const normalized: Coord[] = coords.map(([r, c]) => [r - minR, c - minC])
  // Sort for canonical representation
  normalized.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return normalized
}

export function rotate90(coords: Coord[]): Coord[] {
  return normalizeCoords(coords.map(([r, c]) => [c, -r]))
}

export function flipH(coords: Coord[]): Coord[] {
  return normalizeCoords(coords.map(([r, c]) => [r, -c]))
}

export function flipV(coords: Coord[]): Coord[] {
  return normalizeCoords(coords.map(([r, c]) => [-r, c]))
}

export function getTransformedCoords(
  shape: Coord[],
  rotation: number,
  flipHFlag: boolean,
  flipVFlag: boolean,
): Coord[] {
  let coords: Coord[] = shape.map(([r, c]) => [r, c])
  if (flipHFlag) coords = flipH(coords)
  if (flipVFlag) coords = flipV(coords)
  for (let i = 0; i < rotation; i++) coords = rotate90(coords)
  return coords
}

/**
 * Compute all 8 orientations of a shape (4 rotations x 2 flips).
 * Returns array of normalized coord arrays, deduplicated.
 */
export function getAllOrientations(shape: Coord[]): Coord[][] {
  const seen = new Set<string>()
  const result: Coord[][] = []
  for (const flipHFlag of [false, true]) {
    for (let rot = 0; rot < 4; rot++) {
      const transformed = getTransformedCoords(shape, rot, flipHFlag, false)
      const key = JSON.stringify(transformed)
      if (!seen.has(key)) {
        seen.add(key)
        result.push(transformed)
      }
    }
  }
  return result
}

/* ── COLOR UTILITY ── */

export function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dr = Math.round(r * (1 - factor))
  const dg = Math.round(g * (1 - factor))
  const db = Math.round(b * (1 - factor))
  return '#' + [dr, dg, db].map((v) => Math.max(0, v).toString(16).padStart(2, '0')).join('')
}

/* ── CONNECTIVITY (BFS) ── */

export function isConnected(shape: Coord[]): boolean {
  if (shape.length <= 1) return true
  const set = new Set(shape.map(([r, c]) => `${r},${c}`))
  const visited = new Set<string>()
  const queue: string[] = [`${shape[0][0]},${shape[0][1]}`]
  visited.add(queue[0])
  while (queue.length > 0) {
    const [r, c] = queue.shift()!.split(',').map(Number)
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr
      const nc = c + dc
      const key = `${nr},${nc}`
      if (set.has(key) && !visited.has(key)) {
        visited.add(key)
        queue.push(key)
      }
    }
  }
  return visited.size === shape.length
}

/* ── BOARD LOGIC ── */

export interface OccupiedCell {
  pieceId: string
  color: string
}

export function getOccupiedCells(
  board: BoardState,
  library: Piece[],
): Record<string, OccupiedCell> {
  const occupied: Record<string, OccupiedCell> = {}
  for (const pl of board.placements) {
    const piece = library.find((p) => p.id === pl.pieceId)
    if (!piece) continue
    const coords = getTransformedCoords(piece.shape, pl.rotation, pl.flipH, pl.flipV)
    for (const [dr, dc] of coords) {
      const r = pl.originR + dr
      const c = pl.originC + dc
      occupied[`${r},${c}`] = { pieceId: pl.pieceId, color: piece.color }
    }
  }
  return occupied
}

export function isValidPlacement(
  board: BoardState,
  library: Piece[],
  pieceId: string,
  originR: number,
  originC: number,
  rotation: number,
  flipHFlag: boolean,
  flipVFlag: boolean,
): boolean {
  const piece = library.find((p) => p.id === pieceId)
  if (!piece) return false
  const coords = getTransformedCoords(piece.shape, rotation, flipHFlag, flipVFlag)
  const occupied = getOccupiedCells(board, library)
  for (const [dr, dc] of coords) {
    const r = originR + dr
    const c = originC + dc
    if (r < 0 || r >= board.rows || c < 0 || c >= board.cols) return false
    if (occupied[`${r},${c}`]) return false
  }
  return true
}

export function countPieceUsage(board: BoardState, pieceId: string): number {
  return board.placements.filter((p) => p.pieceId === pieceId).length
}

export function getTransformLabel(sel: ActiveSelection): string {
  const parts: string[] = []
  if (sel.rotation > 0) parts.push(sel.rotation * 90 + '°')
  if (sel.flipH) parts.push('水平翻转')
  if (sel.flipV) parts.push('垂直翻转')
  return parts.length > 0 ? '[' + parts.join(', ') + ']' : ''
}

/* ── LOCAL STORAGE (preserves EXACT legacy keys + shapes) ── */

export function loadLibrary(): Piece[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PIECES)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data) && data.length > 0) {
        // Migrate old builtin pieces to current bright colors
        let migrated = false
        for (const piece of data) {
          if (typeof piece.id === 'string' && piece.id.startsWith('builtin_')) {
            const def = DEFAULT_PIECES.find((d) => d.id === piece.id)
            if (def && piece.color !== def.color) {
              piece.color = def.color
              migrated = true
            }
          }
        }
        if (migrated) {
          localStorage.setItem(STORAGE_KEY_PIECES, JSON.stringify(data))
        }
        return data as Piece[]
      }
    }
  } catch {
    /* corrupt data, use defaults */
  }
  // First-time: seed with default pieces
  const defaults = DEFAULT_PIECES.map((p) => ({ ...p }))
  saveLibrary(defaults)
  return defaults
}

export function saveLibrary(lib: Piece[]): void {
  localStorage.setItem(STORAGE_KEY_PIECES, JSON.stringify(lib))
}

export function loadBoardSession(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOARD)
    if (raw) {
      const data = JSON.parse(raw)
      if (
        data &&
        typeof data.rows === 'number' &&
        typeof data.cols === 'number' &&
        Array.isArray(data.placements)
      ) {
        return { rows: data.rows, cols: data.cols, placements: data.placements }
      }
    }
  } catch {
    /* corrupt */
  }
  return { rows: 8, cols: 8, placements: [] }
}

export function saveBoardSession(board: BoardState): void {
  localStorage.setItem(STORAGE_KEY_BOARD, JSON.stringify(board))
}

/**
 * Merge imported pieces into the library (dedup by canonical orientation).
 * Returns the new library plus counts. Pure — mutates a working copy of input.
 */
export function importPieces(
  current: Piece[],
  data: unknown,
  paletteIdxStart: number,
): { library: Piece[]; added: number; skipped: number; paletteIdx: number } {
  if (!Array.isArray(data)) throw new Error('Not an array')
  const library = current.slice()
  const existingIds = new Set(library.map((p) => p.id))
  let added = 0
  let skipped = 0
  let paletteIdx = paletteIdxStart
  for (const raw of data) {
    const piece = raw as Piece
    if (!piece || !piece.id || !Array.isArray(piece.shape) || piece.shape.length === 0) continue
    // Deduplicate by shape key (canonical orientation)
    const orientations = getAllOrientations(piece.shape)
    const canonicalKey = JSON.stringify(orientations[0])
    const exists = library.some((p) => {
      const pOrient = getAllOrientations(p.shape)
      return JSON.stringify(pOrient[0]) === canonicalKey
    })
    if (exists) {
      skipped++
      continue
    }
    // Assign new ID if collision
    if (existingIds.has(piece.id)) {
      piece.id = 'imp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    }
    if (!piece.color) {
      piece.color = DEFAULT_PALETTE[paletteIdx % DEFAULT_PALETTE.length]
      paletteIdx++
    }
    existingIds.add(piece.id)
    library.push(piece)
    added++
  }
  return { library, added, skipped, paletteIdx }
}
