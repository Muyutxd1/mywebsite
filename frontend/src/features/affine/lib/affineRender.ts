/**
 * Imperative canvas renderer for the affine visualizer.
 * Pure drawing — no React. Ported from legacy drawGrid/drawShape/drawDivider/
 * renderAll, restyled for the dark "deep-space ink" theme. Reads live state
 * passed in by the React component (which keeps it in refs).
 */
import {
  canvasToWorld,
  getTransformedVertices,
  gridStep,
  majorGridStep,
  worldToCanvas,
  type Pt,
  type Rect,
  type View,
} from './affineMath'
import type { AffineState, HoverState } from '../types'

// Dark-theme palette (mirrors src/index.css @theme tokens; canvas needs raw hex).
const PALETTE = {
  panelBg: '#0e0f18',
  gridMinor: '#1d212c',
  gridMajor: '#2a2f3e',
  axis: '#6b7180',
  axisLabel: '#969cb0', // muted
  tick: '#6c7283',
  origin: '#969cb0',
  divider: '#2a2f3e',
  blue: '#5aa9ff', // info / "original"
  red: '#ff7aa8', // rose / "transformed"
  hover: '#e7b455', // gold highlight
  vertexRing: '#0a0b12', // bg, ring around handles
  vertexLabel: '#edeef4', // fg
  inversion: '#8b7bff', // accent
}

const MONO = '"SF Mono","Fira Code",ui-monospace,monospace'

function drawGrid(ctx: CanvasRenderingContext2D, rect: Rect, view: View) {
  const { x, y, w, h } = rect

  // Panel background
  ctx.fillStyle = PALETTE.panelBg
  ctx.fillRect(x, y, w, h)

  // Visible world range
  const topLeft = canvasToWorld(x, y, view, rect)
  const botRight = canvasToWorld(x + w, y + h, view, rect)
  const xMin = Math.floor(Math.min(topLeft.x, botRight.x))
  const xMax = Math.ceil(Math.max(topLeft.x, botRight.x))
  const yMin = Math.floor(Math.min(topLeft.y, botRight.y))
  const yMax = Math.ceil(Math.max(topLeft.y, botRight.y))

  // Adaptive grid step
  const step = gridStep(view.scale)

  // Minor grid lines
  ctx.strokeStyle = PALETTE.gridMinor
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let wx = xMin; wx <= xMax; wx += step) {
    const p = worldToCanvas(wx, 0, view, rect)
    ctx.moveTo(p.x, y)
    ctx.lineTo(p.x, y + h)
  }
  for (let wy = yMin; wy <= yMax; wy += step) {
    const p = worldToCanvas(0, wy, view, rect)
    ctx.moveTo(x, p.y)
    ctx.lineTo(x + w, p.y)
  }
  ctx.stroke()

  // Major grid lines
  const majorStep = majorGridStep(step)
  ctx.strokeStyle = PALETTE.gridMajor
  ctx.lineWidth = 0.8
  ctx.beginPath()
  for (let wx = Math.floor(xMin / majorStep) * majorStep; wx <= xMax; wx += majorStep) {
    const p = worldToCanvas(wx, 0, view, rect)
    ctx.moveTo(p.x, y)
    ctx.lineTo(p.x, y + h)
  }
  for (let wy = Math.floor(yMin / majorStep) * majorStep; wy <= yMax; wy += majorStep) {
    const p = worldToCanvas(0, wy, view, rect)
    ctx.moveTo(x, p.y)
    ctx.lineTo(x + w, p.y)
  }
  ctx.stroke()

  // Axes
  const origin = worldToCanvas(0, 0, view, rect)
  ctx.strokeStyle = PALETTE.axis
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, origin.y)
  ctx.lineTo(x + w, origin.y)
  ctx.moveTo(origin.x, y)
  ctx.lineTo(origin.x, y + h)
  ctx.stroke()

  // Axis arrows
  ctx.fillStyle = PALETTE.axis
  const xEnd = worldToCanvas(xMax, 0, view, rect)
  ctx.beginPath()
  ctx.moveTo(xEnd.x - 8, xEnd.y - 4)
  ctx.lineTo(xEnd.x, xEnd.y)
  ctx.lineTo(xEnd.x - 8, xEnd.y + 4)
  ctx.fill()
  const yEnd = worldToCanvas(0, yMax, view, rect)
  ctx.beginPath()
  ctx.moveTo(yEnd.x - 4, yEnd.y + 8)
  ctx.lineTo(yEnd.x, yEnd.y)
  ctx.lineTo(yEnd.x + 4, yEnd.y + 8)
  ctx.fill()

  // Axis labels
  ctx.fillStyle = PALETTE.axisLabel
  ctx.font = `12px ${MONO}`
  ctx.textAlign = 'center'
  ctx.fillText('x', xEnd.x - 4, xEnd.y - 10)
  ctx.fillText('y', yEnd.x + 14, yEnd.y + 4)

  // Tick labels
  ctx.fillStyle = PALETTE.tick
  ctx.font = `10px ${MONO}`
  for (let wx = Math.ceil(xMin); wx <= xMax; wx += majorStep) {
    if (wx === 0) continue
    const p = worldToCanvas(wx, 0, view, rect)
    ctx.textAlign = 'center'
    ctx.fillText(String(wx), p.x, Math.min(y + h - 2, origin.y + 14))
  }
  for (let wy = Math.ceil(yMin); wy <= yMax; wy += majorStep) {
    if (wy === 0) continue
    const p = worldToCanvas(0, wy, view, rect)
    ctx.textAlign = 'right'
    ctx.fillText(String(wy), Math.max(x + 2, origin.x - 6), p.y + 4)
  }

  // Origin label
  ctx.fillStyle = PALETTE.origin
  ctx.font = `bold 11px ${MONO}`
  ctx.textAlign = 'right'
  ctx.fillText('O', origin.x - 8, origin.y + 14)
}

function withAlpha(hex: string, aa: string): string {
  return hex + aa
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  vertices: Pt[],
  view: View,
  rect: Rect,
  color: string,
  drawVertices: boolean,
  highlightIdx: number,
) {
  if (vertices.length < 2) return
  // Guard against non-finite (e.g. inversion of center → Infinity)
  const finite = vertices.every((v) => Number.isFinite(v.x) && Number.isFinite(v.y))
  if (!finite) return

  const pts = vertices.map((v) => worldToCanvas(v.x, v.y, view, rect))

  // Fill (~12% opacity)
  ctx.fillStyle = withAlpha(color, '22')
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  ctx.fill()

  // Stroke
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  ctx.stroke()

  // Vertex handles
  if (drawVertices) {
    for (let i = 0; i < pts.length; i++) {
      const isHovered = highlightIdx === i
      const r = isHovered ? 7 : 5
      ctx.fillStyle = isHovered ? PALETTE.hover : color
      ctx.strokeStyle = PALETTE.vertexRing
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  // Vertex labels A, B, C, D…
  ctx.fillStyle = PALETTE.vertexLabel
  ctx.font = 'bold 12px ui-sans-serif, system-ui, sans-serif'
  for (let i = 0; i < pts.length; i++) {
    const label = String.fromCharCode(65 + i)
    ctx.textAlign = 'center'
    ctx.fillText(label, pts[i].x, pts[i].y - 12)
  }
}

function drawDivider(ctx: CanvasRenderingContext2D, cssWidth: number, cssHeight: number, stacked: boolean) {
  if (stacked) {
    const midY = Math.floor(cssHeight / 2)
    ctx.fillStyle = PALETTE.divider
    ctx.fillRect(0, midY - 1, cssWidth, 2)
  } else {
    const midX = Math.floor(cssWidth / 2)
    ctx.fillStyle = PALETTE.divider
    ctx.fillRect(midX - 1, 0, 2, cssHeight)
  }
}

export interface Layout {
  leftRect: Rect
  rightRect: Rect
  stacked: boolean
}

const DIVIDER_WIDTH = 3

/** Compute the two viewport rects in CSS pixels. Stacks vertically when narrow. */
export function computeLayout(cssWidth: number, cssHeight: number, stacked: boolean): Layout {
  if (stacked) {
    const midY = Math.floor(cssHeight / 2)
    return {
      leftRect: { x: 0, y: 0, w: cssWidth, h: midY },
      rightRect: { x: 0, y: midY + DIVIDER_WIDTH, w: cssWidth, h: cssHeight - midY - DIVIDER_WIDTH },
      stacked,
    }
  }
  const midX = Math.floor(cssWidth / 2)
  return {
    leftRect: { x: 0, y: 0, w: midX, h: cssHeight },
    rightRect: { x: midX + DIVIDER_WIDTH, y: 0, w: cssWidth - midX - DIVIDER_WIDTH, h: cssHeight },
    stacked,
  }
}

/** Full repaint. ctx must already be DPR-scaled so we draw in CSS pixels. */
export function renderAll(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  layout: Layout,
  state: AffineState,
  shapeVertices: Pt[],
  hovered: HoverState | null,
) {
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  // Left — Original
  drawGrid(ctx, layout.leftRect, state.viewLeft)
  drawShape(
    ctx,
    shapeVertices,
    state.viewLeft,
    layout.leftRect,
    PALETTE.blue,
    true,
    hovered && hovered.side === 'left' ? hovered.idx : -1,
  )
  ctx.fillStyle = PALETTE.blue
  ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('原始图形', layout.leftRect.x + 12, layout.leftRect.y + 22)

  // Right — Transformed
  drawGrid(ctx, layout.rightRect, state.viewRight)
  const transformedVertices = getTransformedVertices(shapeVertices, state)

  // Inversion circle
  if (state.inversionMode) {
    const ctr = worldToCanvas(state.inversionCX, state.inversionCY, state.viewRight, layout.rightRect)
    const rPx = state.inversionR * state.viewRight.scale
    ctx.strokeStyle = PALETTE.inversion
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.arc(ctr.x, ctr.y, rPx, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = PALETTE.inversion
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`反演圆 R=${state.inversionR.toFixed(1)}`, ctr.x + rPx + 4, ctr.y - 4)
  }

  drawShape(
    ctx,
    transformedVertices,
    state.viewRight,
    layout.rightRect,
    PALETTE.red,
    true,
    hovered && hovered.side === 'right' ? hovered.idx : -1,
  )
  ctx.fillStyle = PALETTE.red
  ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(state.inversionMode ? '仿射+反演' : '变换后图形', layout.rightRect.x + 12, layout.rightRect.y + 22)

  drawDivider(ctx, cssWidth, cssHeight, layout.stacked)
}
