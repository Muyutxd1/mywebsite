/**
 * Affine / Projective Transformation math — PURE module (no React).
 * Ported VERBATIM from _legacy/static/js/affine.js. Same coordinate
 * conventions, transform order, and projective denominator are preserved
 * so behavior stays identical to the legacy visualizer.
 */

export type Mat = number[] // flat 9-element array, row-major
export interface Pt {
  x: number
  y: number
}
export interface View {
  cx: number
  cy: number
  scale: number
}
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/* ───────── MATRIX MATH (3×3 homogeneous) ───────── */

export function matIdentity(): Mat {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1]
}

export function matMul(A: Mat, B: Mat): Mat {
  // A, B are flat 9-element arrays (row-major)
  const r = new Array(9).fill(0)
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]
  return r
}

export function matInv(M: Mat): Mat | null {
  // Inverse of 3x3 matrix
  const [a, b, c, d, e, f, g, h, i] = M
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (Math.abs(det) < 1e-12) return null
  const invDet = 1 / det
  return [
    (e * i - f * h) * invDet,
    (c * h - b * i) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * i) * invDet,
    (a * i - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * h - e * g) * invDet,
    (b * g - a * h) * invDet,
    (a * e - b * d) * invDet,
  ]
}

export function applyTransform(M: Mat, x: number, y: number): Pt {
  // Apply homogeneous 3x3 matrix M to point (x,y)
  const [a, b, tx, c, d, ty, g, h, w] = M
  const denom = g * x + h * y + w
  return {
    x: (a * x + b * y + tx) / denom,
    y: (c * x + d * y + ty) / denom,
  }
}

export function applyInversion(x: number, y: number, cx: number, cy: number, R: number): Pt {
  // Inversion in circle center (cx,cy) radius R: OP × OP' = R²
  const dx = x - cx
  const dy = y - cy
  const d2 = dx * dx + dy * dy
  if (d2 < 1e-10) return { x: Infinity, y: Infinity } // center maps to infinity
  const k = (R * R) / d2
  return { x: cx + dx * k, y: cy + dy * k }
}

/* ───────── PRESET TRANSFORMATIONS ───────── */

export function makeTranslate(tx: number, ty: number): Mat {
  return [1, 0, tx, 0, 1, ty, 0, 0, 1]
}

export function makeRotate(deg: number): Mat {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r),
    s = Math.sin(r)
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

export function makeScale(sx: number, sy: number): Mat {
  return [sx, 0, 0, 0, sy, 0, 0, 0, 1]
}

export function makeShear(shx: number, shy: number): Mat {
  return [1, shx, 0, shy, 1, 0, 0, 0, 1]
}

export function makeReflect(axis: 'x' | 'y' | string): Mat {
  if (axis === 'x') return [1, 0, 0, 0, -1, 0, 0, 0, 1]
  if (axis === 'y') return [-1, 0, 0, 0, 1, 0, 0, 0, 1]
  return matIdentity()
}

export interface Preset {
  name: string
  mat: Mat
}

export const PRESETS: Preset[] = [
  { name: '恒等变换', mat: matIdentity() },
  { name: '平移 (2, 1)', mat: makeTranslate(2, 1) },
  { name: '旋转 90°', mat: makeRotate(90) },
  { name: '旋转 45°', mat: makeRotate(45) },
  { name: '缩放 ×2', mat: makeScale(2, 2) },
  { name: '缩放 ×½', mat: makeScale(0.5, 0.5) },
  { name: 'X 轴反射', mat: makeReflect('x') },
  { name: 'Y 轴反射', mat: makeReflect('y') },
  { name: '剪切 X', mat: makeShear(1, 0) },
  { name: '剪切 Y', mat: makeShear(0, 1) },
  { name: '压缩 X', mat: makeScale(0.3, 1) },
]

/* ───────── DEFAULT SHAPE ───────── */

// Default shape: a right triangle + extra vertex to make a kite-like shape
// that clearly shows rotation/reflection
export const defaultShape: Pt[] = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 1, y: 2 },
]

/* ───────── COORDINATE CONVERSION ───────── */

export function worldToCanvas(wx: number, wy: number, view: View, rect: Rect): Pt {
  return {
    x: rect.x + rect.w / 2 + (wx - view.cx) * view.scale,
    y: rect.y + rect.h / 2 - (wy - view.cy) * view.scale,
  }
}

export function canvasToWorld(cx: number, cy: number, view: View, rect: Rect): Pt {
  return {
    x: view.cx + (cx - rect.x - rect.w / 2) / view.scale,
    y: view.cy - (cy - rect.y - rect.h / 2) / view.scale,
  }
}

/* ───────── ADAPTIVE GRID STEPPING ───────── */

export function gridStep(scale: number): number {
  return scale > 80 ? 0.5 : scale > 40 ? 1 : scale > 15 ? 2 : 5
}

export function majorGridStep(step: number): number {
  return step < 1 ? 1 : step * 2
}

/* ───────── AUTO-FIT VIEW ───────── */

/**
 * Compute both viewports so the original shape fits the left view and the
 * transformed shape fits the right view, sharing one scale.
 * Non-finite transformed vertices are skipped (singular / inversion-to-infinity).
 */
export function autoFitView(
  shapeVertices: Pt[],
  transformedVertices: Pt[],
  leftRect: Rect,
): { viewLeft: View; viewRight: View } {
  // ── Left view: center on original shape ──
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const v of shapeVertices) {
    minX = Math.min(minX, v.x)
    maxX = Math.max(maxX, v.x)
    minY = Math.min(minY, v.y)
    maxY = Math.max(maxY, v.y)
  }
  const cxL = (minX + maxX) / 2
  const cyL = (minY + maxY) / 2
  const spanXL = maxX - minX || 2
  const spanYL = maxY - minY || 2

  // ── Right view: center on TRANSFORMED shape ──
  minX = Infinity
  maxX = -Infinity
  minY = Infinity
  maxY = -Infinity
  let any = false
  for (const v of transformedVertices) {
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) continue // skip non-finite in autoFit
    any = true
    minX = Math.min(minX, v.x)
    maxX = Math.max(maxX, v.x)
    minY = Math.min(minY, v.y)
    maxY = Math.max(maxY, v.y)
  }
  const cxR = any ? (minX + maxX) / 2 : cxL
  const cyR = any ? (minY + maxY) / 2 : cyL
  const spanXR = any ? maxX - minX || 2 : spanXL
  const spanYR = any ? maxY - minY || 2 : spanYL

  // Use the larger span across both views for consistent scale
  const spanX = Math.max(spanXL, spanXR, Math.abs(cxL), Math.abs(cxR))
  const spanY = Math.max(spanYL, spanYR, Math.abs(cyL), Math.abs(cyR))
  const pad = Math.max(spanX, spanY) * 1.2

  const scale = Math.min((leftRect.w * 0.65) / (spanX + pad * 2), (leftRect.h * 0.65) / (spanY + pad * 2))

  return {
    viewLeft: { cx: cxL, cy: cyL, scale },
    viewRight: { cx: cxR, cy: cyR, scale },
  }
}

/* ───────── MATRIX HELPERS ───────── */

export interface TransformConfig {
  transformMatrix: Mat
  projectiveMode: boolean
  projectiveG: number
  projectiveH: number
  inversionMode: boolean
  inversionCX: number
  inversionCY: number
  inversionR: number
}

export function buildFullMatrix(cfg: {
  transformMatrix: Mat
  projectiveMode: boolean
  projectiveG: number
  projectiveH: number
}): Mat {
  const M = [...cfg.transformMatrix]
  if (cfg.projectiveMode) {
    M[6] = cfg.projectiveG
    M[7] = cfg.projectiveH
  }
  return M
}

export function getTransformedVertices(shapeVertices: Pt[], cfg: TransformConfig): Pt[] {
  // Apply affine (+ optional projective) transform, then inversion if enabled
  const M = buildFullMatrix(cfg)
  let verts = shapeVertices.map((v) => applyTransform(M, v.x, v.y))
  if (cfg.inversionMode) {
    verts = verts.map((v) => applyInversion(v.x, v.y, cfg.inversionCX, cfg.inversionCY, cfg.inversionR))
  }
  return verts
}

export function fmtMatVal(v: number): string {
  if (Math.abs(v) < 1e-10) return '0'
  return parseFloat(v.toFixed(3)).toString()
}
