/**
 * Imperative canvas drawing for the polyomino board.
 * Pure functions (no React) — called from a requestAnimationFrame loop so that
 * hover/ghost redraws never route through React state (avoids re-render churn).
 *
 * Ported from legacy renderBoard(), with devicePixelRatio handling added
 * (legacy ignored DPR). The board surface is a white-on-dark checkerboard
 * exactly as specified for the new dark design.
 */
import {
  darkenColor,
  getOccupiedCells,
  getTransformedCoords,
  isValidPlacement,
  type ActiveSelection,
  type BoardState,
  type Coord,
  type Piece,
} from './polyominoMath'
import type { HoverCell } from '../types'

// Board palette (white-on-dark checkerboard for the dark studio).
const COLOR_BG = '#0f1117'
const COLOR_LIGHT = '#e8eaf0'
const COLOR_DARK = '#cdd2de'
const COLOR_GRID = 'rgba(20,24,33,0.55)'

export function computeCellSize(
  rows: number,
  cols: number,
  maxWidth: number,
  maxHeight: number,
): number {
  const cellW = Math.floor((maxWidth - 2) / cols)
  const cellH = Math.floor((maxHeight - 2) / rows)
  return Math.max(14, Math.min(48, cellW, cellH))
}

export interface DrawParams {
  canvas: HTMLCanvasElement
  board: BoardState
  library: Piece[]
  active: ActiveSelection | null
  hover: HoverCell | null
  cellSize: number
}

/**
 * Sets canvas pixel buffer (DPR-aware) + CSS size, then draws everything.
 * Returns the CSS width/height so callers can size containers.
 */
export function drawBoard({ canvas, board, library, active, hover, cellSize }: DrawParams): {
  cssWidth: number
  cssHeight: number
} {
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  const cssWidth = board.cols * cellSize + 1
  const cssHeight = board.rows * cellSize + 1

  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssHeight * dpr)
  canvas.style.width = cssWidth + 'px'
  canvas.style.height = cssHeight + 'px'

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const occupied = getOccupiedCells(board, library)

  // Layer 1: Background
  ctx.fillStyle = COLOR_BG
  ctx.fillRect(0, 0, cssWidth, cssHeight)

  // Layer 2: Checkerboard (2x2 blocks)
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const light = (Math.floor(r / 2) + Math.floor(c / 2)) % 2 === 0
      ctx.fillStyle = light ? COLOR_LIGHT : COLOR_DARK
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)
    }
  }

  // Layer 3: Grid lines
  ctx.strokeStyle = COLOR_GRID
  ctx.lineWidth = 0.5
  for (let r = 0; r <= board.rows; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * cellSize)
    ctx.lineTo(board.cols * cellSize, r * cellSize)
    ctx.stroke()
  }
  for (let c = 0; c <= board.cols; c++) {
    ctx.beginPath()
    ctx.moveTo(c * cellSize, 0)
    ctx.lineTo(c * cellSize, board.rows * cellSize)
    ctx.stroke()
  }

  // Layer 4: Placed pieces
  for (const pl of board.placements) {
    const piece = library.find((p) => p.id === pl.pieceId)
    if (!piece) continue
    const coords = getTransformedCoords(piece.shape, pl.rotation, pl.flipH, pl.flipV)
    const cellSet = new Set(coords.map(([dr, dc]) => `${pl.originR + dr},${pl.originC + dc}`))

    // Fill all cells
    for (const [dr, dc] of coords) {
      const r = pl.originR + dr
      const c = pl.originC + dc
      const x = c * cellSize
      const y = r * cellSize
      ctx.fillStyle = piece.color
      ctx.fillRect(x + 1, y + 1, cellSize - 1, cellSize - 1)
    }

    // Connection lines (center-to-center). Orthogonal first (thicker).
    const drawnEdges = new Set<string>()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = Math.max(1.2, cellSize * 0.09)
    ctx.lineCap = 'round'
    for (const [dr, dc] of coords) {
      const r = pl.originR + dr
      const c = pl.originC + dc
      const cx = (c + 0.5) * cellSize
      const cy = (r + 0.5) * cellSize
      for (const [nr, nc] of [[r, c + 1], [r + 1, c]]) {
        if (cellSet.has(`${nr},${nc}`)) {
          const edgeKey = `${Math.min(r, nr)},${Math.min(c, nc)}-${Math.max(r, nr)},${Math.max(c, nc)}`
          if (!drawnEdges.has(edgeKey)) {
            drawnEdges.add(edgeKey)
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.lineTo((nc + 0.5) * cellSize, (nr + 0.5) * cellSize)
            ctx.stroke()
          }
        }
      }
    }
    // Diagonal connections (thinner, more transparent)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = Math.max(0.8, cellSize * 0.05)
    for (const [dr, dc] of coords) {
      const r = pl.originR + dr
      const c = pl.originC + dc
      const cx = (c + 0.5) * cellSize
      const cy = (r + 0.5) * cellSize
      for (const [nr, nc] of [[r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1]]) {
        if (cellSet.has(`${nr},${nc}`)) {
          const edgeKey = `${Math.min(r, nr)},${Math.min(c, nc)}-${Math.max(r, nr)},${Math.max(c, nc)}`
          if (!drawnEdges.has(edgeKey)) {
            drawnEdges.add(edgeKey)
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.lineTo((nc + 0.5) * cellSize, (nr + 0.5) * cellSize)
            ctx.stroke()
          }
        }
      }
    }

    // Outer perimeter only (edges not shared with another cell of same piece)
    ctx.strokeStyle = darkenColor(piece.color, 0.3)
    ctx.lineWidth = Math.max(2, cellSize * 0.15)
    ctx.lineCap = 'square'
    for (const [dr, dc] of coords) {
      const r = pl.originR + dr
      const c = pl.originC + dc
      const x = c * cellSize
      const y = r * cellSize
      if (!cellSet.has(`${r - 1},${c}`)) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y); ctx.stroke()
      }
      if (!cellSet.has(`${r + 1},${c}`)) {
        ctx.beginPath(); ctx.moveTo(x, y + cellSize); ctx.lineTo(x + cellSize, y + cellSize); ctx.stroke()
      }
      if (!cellSet.has(`${r},${c - 1}`)) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cellSize); ctx.stroke()
      }
      if (!cellSet.has(`${r},${c + 1}`)) {
        ctx.beginPath(); ctx.moveTo(x + cellSize, y); ctx.lineTo(x + cellSize, y + cellSize); ctx.stroke()
      }
    }
  }

  // Layer 5: Ghost preview of active piece
  if (active && hover) {
    const piece = library.find((p) => p.id === active.pieceId)
    if (piece) {
      const coords = getTransformedCoords(piece.shape, active.rotation, active.flipH, active.flipV)
      const valid = isValidPlacement(
        board, library, active.pieceId, hover.r, hover.c,
        active.rotation, active.flipH, active.flipV,
      )

      const ghostCells: Coord[] = []
      for (const [dr, dc] of coords) {
        const r = hover.r + dr
        const c = hover.c + dc
        if (r < 0 || r >= board.rows || c < 0 || c >= board.cols) continue
        ghostCells.push([r, c])
      }
      const ghostSet = new Set(ghostCells.map(([r, c]) => `${r},${c}`))

      const fillColor = valid ? 'rgba(0, 200, 100, 0.34)' : 'rgba(255, 80, 80, 0.34)'
      const lineColor = valid ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)'
      const diagColor = valid ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'

      for (const [r, c] of ghostCells) {
        ctx.fillStyle = fillColor
        ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2)
      }

      // Orthogonal connection lines
      ctx.lineCap = 'round'
      ctx.strokeStyle = lineColor
      ctx.lineWidth = Math.max(1, cellSize * 0.07)
      const drawnEdges = new Set<string>()
      for (const [r, c] of ghostCells) {
        const cx = (c + 0.5) * cellSize
        const cy = (r + 0.5) * cellSize
        for (const [nr, nc] of [[r, c + 1], [r + 1, c]]) {
          if (ghostSet.has(`${nr},${nc}`)) {
            const ek = `${Math.min(r, nr)},${Math.min(c, nc)}-${Math.max(r, nr)},${Math.max(c, nc)}`
            if (!drawnEdges.has(ek)) {
              drawnEdges.add(ek)
              ctx.beginPath()
              ctx.moveTo(cx, cy)
              ctx.lineTo((nc + 0.5) * cellSize, (nr + 0.5) * cellSize)
              ctx.stroke()
            }
          }
        }
      }
      // Diagonal connection lines
      ctx.strokeStyle = diagColor
      ctx.lineWidth = Math.max(0.6, cellSize * 0.04)
      for (const [r, c] of ghostCells) {
        const cx = (c + 0.5) * cellSize
        const cy = (r + 0.5) * cellSize
        for (const [nr, nc] of [[r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1]]) {
          if (ghostSet.has(`${nr},${nc}`)) {
            const ek = `${Math.min(r, nr)},${Math.min(c, nc)}-${Math.max(r, nr)},${Math.max(c, nc)}`
            if (!drawnEdges.has(ek)) {
              drawnEdges.add(ek)
              ctx.beginPath()
              ctx.moveTo(cx, cy)
              ctx.lineTo((nc + 0.5) * cellSize, (nr + 0.5) * cellSize)
              ctx.stroke()
            }
          }
        }
      }

      // Dashed outline around entire ghost shape (green=valid / red=invalid)
      ctx.strokeStyle = valid ? 'rgba(0, 220, 110, 0.85)' : 'rgba(255, 80, 80, 0.85)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([3, 2])
      for (const [r, c] of ghostCells) {
        const x = c * cellSize
        const y = r * cellSize
        if (!ghostSet.has(`${r - 1},${c}`)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y); ctx.stroke() }
        if (!ghostSet.has(`${r + 1},${c}`)) { ctx.beginPath(); ctx.moveTo(x, y + cellSize); ctx.lineTo(x + cellSize, y + cellSize); ctx.stroke() }
        if (!ghostSet.has(`${r},${c - 1}`)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cellSize); ctx.stroke() }
        if (!ghostSet.has(`${r},${c + 1}`)) { ctx.beginPath(); ctx.moveTo(x + cellSize, y); ctx.lineTo(x + cellSize, y + cellSize); ctx.stroke() }
      }
      ctx.setLineDash([])
    }
  }

  // Layer 6: Hover highlight (IDLE mode only)
  if (hover && !active) {
    ctx.strokeStyle = 'rgba(124, 92, 255, 0.7)'
    ctx.lineWidth = 2
    ctx.strokeRect(hover.c * cellSize + 1, hover.r * cellSize + 1, cellSize - 2, cellSize - 2)
  }

  return { cssWidth, cssHeight }
}

/** Maps a pointer event (mouse/touch) to a board cell, DPR-independent. */
export function cellFromPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  cellSize: number,
  board: BoardState,
): HoverCell | null {
  const rect = canvas.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const c = Math.floor(x / cellSize)
  const r = Math.floor(y / cellSize)
  if (r < 0 || r >= board.rows || c < 0 || c >= board.cols) return null
  return { r, c }
}

/** Draws a small centered thumbnail of a shape (library item / preview), DPR-aware. */
export function drawThumbnail(
  canvas: HTMLCanvasElement,
  shape: Coord[],
  color: string,
  boxSize: number,
): void {
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  canvas.width = Math.round(boxSize * dpr)
  canvas.height = Math.round(boxSize * dpr)
  canvas.style.width = boxSize + 'px'
  canvas.style.height = boxSize + 'px'
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, boxSize, boxSize)
  if (shape.length === 0) return
  const maxR = Math.max(...shape.map(([r]) => r), 0) + 1
  const maxC = Math.max(...shape.map(([, c]) => c), 0) + 1
  const cs = Math.max(1, Math.floor((boxSize - 6) / Math.max(maxR, maxC, 1)))
  const offsetX = Math.floor((boxSize - maxC * cs) / 2)
  const offsetY = Math.floor((boxSize - maxR * cs) / 2)
  for (const [r, c] of shape) {
    ctx.fillStyle = color
    ctx.fillRect(offsetX + c * cs + 1, offsetY + r * cs + 1, cs - 1, cs - 1)
  }
}
