/**
 * 3D Polycube engine — PURE TypeScript (no React, no three).
 *
 * Ported VERBATIM from _legacy/static/js/polycube-studio.js.
 * The 24-orientation enumeration order is BYTE-IDENTICAL to the legacy code
 * because `rotIdx` is persisted in localStorage / JSON exports — the index→matrix
 * mapping MUST stay stable for saved boards and exported pieces to remain valid.
 */

export type Cell = [number, number, number]
export type Mat3 = number[][]

export interface Piece {
  id: string
  name: string
  cells: Cell[]
  color: string
}

export interface Placement {
  pieceId: string
  ox: number
  oy: number
  oz: number
  rotIdx: number
}

export interface BoardState {
  sx: number
  sy: number
  sz: number
  placements: Placement[]
}

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

export const STORAGE_KEY_PC = 'polycube_pieces'
export const STORAGE_KEY_BOARD = 'polycube_board'

export const PALETTE: string[] = [
  '#FF6B6B', '#4D96FF', '#6BCB77', '#FF8E53', '#9B59B6',
  '#FFD93D', '#FF6FB7', '#00D2D3', '#F368E0', '#54A0FF',
  '#FFA502', '#2ED573', '#FF4757', '#7BED9F', '#70A1FF',
  '#FECA57', '#5F27CD', '#01A3A4', '#FF6348', '#FF9FF3',
]

export const DEFAULT_PIECES: Piece[] = [
  { id: 'b_mono', name: '单体', cells: [[0, 0, 0]], color: '#FF6B6B' },
  { id: 'b_domino', name: '双立方', cells: [[0, 0, 0], [0, 1, 0]], color: '#4D96FF' },
  { id: 'b_L3', name: 'L-三立方', cells: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], color: '#6BCB77' },
  { id: 'b_I3', name: 'I-三立方', cells: [[0, 0, 0], [1, 0, 0], [2, 0, 0]], color: '#FF8E53' },
  { id: 'b_cube2', name: '2x2方块', cells: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 0]], color: '#9B59B6' },
  { id: 'b_T4', name: 'T-四立方', cells: [[0, 0, 0], [0, 1, 0], [0, 2, 0], [1, 1, 0]], color: '#FF6FB7' },
  { id: 'b_L4', name: 'L-四立方', cells: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0]], color: '#00D2D3' },
  { id: 'b_Z4', name: 'Z-四立方', cells: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 2, 0]], color: '#FFD93D' },
]

/* ═══════════════════════════════════════════
   3D ROTATIONS (24 cube orientations)
   ═══════════════════════════════════════════ */

export function matMul(a: Mat3, b: Mat3): Mat3 {
  const r: Mat3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        r[i][j] += a[i][k] * b[k][j]
  return r
}

export function rotX90(n: number): Mat3 {
  const c = [1, 0, -1, 0][n], s = [0, 1, 0, -1][n]
  return [[1, 0, 0], [0, c, -s], [0, s, c]]
}
export function rotY90(n: number): Mat3 {
  const c = [1, 0, -1, 0][n], s = [0, -1, 0, 1][n]
  return [[c, 0, s], [0, 1, 0], [-s, 0, c]]
}
export function rotZ90(n: number): Mat3 {
  const c = [1, 0, -1, 0][n], s = [0, 1, 0, -1][n]
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]]
}

let ALL_ROTATIONS: Mat3[] | null = null
export function getAllRotations(): Mat3[] {
  if (ALL_ROTATIONS) return ALL_ROTATIONS
  const seen = new Set<string>()
  ALL_ROTATIONS = []
  for (let rx = 0; rx < 4; rx++) {
    for (let ry = 0; ry < 4; ry++) {
      for (let rz = 0; rz < 4; rz++) {
        const m = matMul(rotZ90(rz), matMul(rotY90(ry), rotX90(rx)))
        const key = m.flat().join(',')
        if (!seen.has(key)) { seen.add(key); ALL_ROTATIONS.push(m) }
      }
    }
  }
  return ALL_ROTATIONS
}

export function applyRotation(cell: Cell, rot: Mat3): Cell {
  return [
    rot[0][0] * cell[0] + rot[0][1] * cell[1] + rot[0][2] * cell[2],
    rot[1][0] * cell[0] + rot[1][1] * cell[1] + rot[1][2] * cell[2],
    rot[2][0] * cell[0] + rot[2][1] * cell[1] + rot[2][2] * cell[2],
  ]
}

export function normalizeCells(cells: Cell[]): Cell[] {
  if (cells.length === 0) return []
  const minX = Math.min(...cells.map((c) => c[0]))
  const minY = Math.min(...cells.map((c) => c[1]))
  const minZ = Math.min(...cells.map((c) => c[2]))
  return cells.map(([x, y, z]) => [x - minX, y - minY, z - minZ] as Cell)
}

export function getTransformedCells(piece: Piece, rotIdx: number): Cell[] {
  const rots = getAllRotations()
  const rot = rots[rotIdx % rots.length]
  return normalizeCells(piece.cells.map((c) => applyRotation(c, rot)))
}

export function composeRotation(rotIdx: number, axis: 'x' | 'y' | 'z', dir: number): number {
  // Compose the current rotation matrix with a 90° rotation around the given axis
  // (local rotation — apply delta after current matrix).
  const rots = getAllRotations()
  const current = rots[((rotIdx % rots.length) + rots.length) % rots.length]
  const angle = dir > 0 ? 1 : 3 // 1 = +90°, 3 = -90° (270°)
  let delta: Mat3
  if (axis === 'x') delta = rotX90(angle)
  else if (axis === 'y') delta = rotY90(angle)
  else delta = rotZ90(angle)
  const result = matMul(current, delta)
  const key = result.flat().join(',')
  const newIdx = rots.findIndex((r) => r.flat().join(',') === key)
  return newIdx >= 0 ? newIdx : rotIdx
}

/* ═══════════════════════════════════════════
   BOARD LOGIC
   ═══════════════════════════════════════════ */

export function getOccupied3D(
  board: BoardState,
  pieceLibrary: Piece[],
): Record<string, string> {
  const occ: Record<string, string> = {}
  for (const pl of board.placements) {
    const piece = pieceLibrary.find((p) => p.id === pl.pieceId)
    if (!piece) continue
    const cells = getTransformedCells(piece, pl.rotIdx)
    for (const [dx, dy, dz] of cells) {
      occ[`${pl.ox + dx},${pl.oy + dy},${pl.oz + dz}`] = piece.color
    }
  }
  return occ
}

export function isValidPlacement(
  board: BoardState,
  pieceLibrary: Piece[],
  pieceId: string,
  ox: number,
  oy: number,
  oz: number,
  rotIdx: number,
): boolean {
  const piece = pieceLibrary.find((p) => p.id === pieceId)
  if (!piece) return false
  const cells = getTransformedCells(piece, rotIdx)
  const occ = getOccupied3D(board, pieceLibrary)
  for (const [dx, dy, dz] of cells) {
    const x = ox + dx, y = oy + dy, z = oz + dz
    if (x < 0 || x >= board.sx || y < 0 || y >= board.sy || z < 0 || z >= board.sz) return false
    if (occ[`${x},${y},${z}`]) return false
  }
  return true
}

/**
 * Find a fully valid placement (in-bounds, no overlap) for a piece such that
 * ONE of its cells lands on `target`. Tries each cell as the anchor and returns
 * the first origin that validates, else null. Used by the mobile tap-to-place 3D
 * surface, where `target` is the floor cell or the neighbour across a tapped face.
 */
export function findPlacementAt(
  board: BoardState,
  pieceLibrary: Piece[],
  pieceId: string,
  rotIdx: number,
  target: Cell,
): Cell | null {
  const piece = pieceLibrary.find((p) => p.id === pieceId)
  if (!piece) return null
  const cells = getTransformedCells(piece, rotIdx)
  for (const [dx, dy, dz] of cells) {
    const origin: Cell = [target[0] - dx, target[1] - dy, target[2] - dz]
    if (isValidPlacement(board, pieceLibrary, pieceId, origin[0], origin[1], origin[2], rotIdx)) {
      return origin
    }
  }
  return null
}

export function computePlacementOrigin(
  board: BoardState,
  pieceLibrary: Piece[],
  pieceId: string,
  rotIdx: number,
  hoverX: number,
  hoverY: number,
  hoverZ: number,
): Cell {
  const piece = pieceLibrary.find((p) => p.id === pieceId)
  if (!piece) return [hoverX, hoverY, hoverZ]
  const cells = getTransformedCells(piece, rotIdx)
  for (const [dx, dy, dz] of cells) {
    const ox = hoverX - dx, oy = hoverY - dy, oz = hoverZ - dz
    let inBounds = true
    for (const [cdx, cdy, cdz] of cells) {
      const cx = ox + cdx, cy = oy + cdy, cz = oz + cdz
      if (cx < 0 || cx >= board.sx || cy < 0 || cy >= board.sy || cz < 0 || cz >= board.sz) {
        inBounds = false
        break
      }
    }
    if (inBounds) return [ox, oy, oz]
  }
  const [dx, dy, dz] = cells[0] || [0, 0, 0]
  return [hoverX - dx, hoverY - dy, hoverZ - dz]
}

/** Map every occupied cell "x,y,z" -> {color, index} (placement index, for removal/coloring). */
export function cellOwners(
  board: BoardState,
  pieceLibrary: Piece[],
): Map<string, { color: string; index: number }> {
  const map = new Map<string, { color: string; index: number }>()
  board.placements.forEach((pl, index) => {
    const piece = pieceLibrary.find((p) => p.id === pl.pieceId)
    if (!piece) return
    for (const [dx, dy, dz] of getTransformedCells(piece, pl.rotIdx)) {
      map.set(`${pl.ox + dx},${pl.oy + dy},${pl.oz + dz}`, { color: piece.color, index })
    }
  })
  return map
}

/** Bounding box size [sx, sy, sz] of a (normalized) cell list. */
export function pieceBounds(cells: Cell[]): Cell {
  let mx = 0, my = 0, mz = 0
  for (const [x, y, z] of cells) {
    mx = Math.max(mx, x)
    my = Math.max(my, y)
    mz = Math.max(mz, z)
  }
  return [mx + 1, my + 1, mz + 1]
}

/* ═══════════════════════════════════════════
   LOCAL STORAGE (exact legacy shapes/keys)
   ═══════════════════════════════════════════ */

export function loadLibrary(): Piece[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PC)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data) && data.length > 0) return data as Piece[]
    }
  } catch {
    /* ignore */
  }
  const defaults = DEFAULT_PIECES.map((p) => ({ ...p, cells: p.cells.map((c) => [...c] as Cell) }))
  localStorage.setItem(STORAGE_KEY_PC, JSON.stringify(defaults))
  return defaults
}

export function saveLibrary(pieceLibrary: Piece[]): void {
  localStorage.setItem(STORAGE_KEY_PC, JSON.stringify(pieceLibrary))
}

export function loadBoardSession(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOARD)
    if (raw) {
      const d = JSON.parse(raw)
      if (d && typeof d.sx === 'number') return d as BoardState
    }
  } catch {
    /* ignore */
  }
  return { sx: 4, sy: 4, sz: 4, placements: [] }
}

export function saveBoardSession(board: BoardState): void {
  localStorage.setItem(STORAGE_KEY_BOARD, JSON.stringify(board))
}
