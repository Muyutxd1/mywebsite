/**
 * 圆反演工作台 — 解析几何引擎（无 React）。
 * 反演：以圆心 O、半径 R 为镜，P ↦ P' = O + R²/|P-O|² · (P-O)。
 * 像用解析方式精确给出（点/线段/直线/圆 → 点/线段/双射线/圆弧/圆/直线）。
 */

export interface Pt {
  x: number
  y: number
}

export interface View {
  cx: number
  cy: number
  scale: number
}

/** 反演像的解析形状。 */
export type ImageShape =
  | { kind: 'none' }
  | { kind: 'point'; p: Pt }
  | { kind: 'segment'; a: Pt; b: Pt }
  /** 两条射线：从 a 沿单位方向 ad、从 b 沿单位方向 bd 各自伸向无穷（线段过反演中心时）。 */
  | { kind: 'rays'; a: Pt; ad: Pt; b: Pt; bd: Pt }
  /** 圆弧：圆心 c、半径 r，从角 a0 扫过 sweep（弧度，带符号）。 */
  | { kind: 'arc'; c: Pt; r: number; a0: number; sweep: number }
  | { kind: 'circle'; c: Pt; r: number }
  /** 无穷直线：过点 p、单位方向 d。 */
  | { kind: 'line'; p: Pt; d: Pt }

const EPS = 1e-9

/* ── 向量小工具 ── */
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y })
const scl = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k })
const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y
const len = (a: Pt): number => Math.hypot(a.x, a.y)
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
function unit(a: Pt): Pt {
  const l = len(a) || 1
  return { x: a.x / l, y: a.y / l }
}
const ang = (v: Pt): number => Math.atan2(v.y, v.x)

/* ═══════════════════ 点反演 ═══════════════════ */

/** 点 (x,y) 关于圆心 (cx,cy)、半径 R 的反演像；与圆心重合时返回 null。 */
export function invert(x: number, y: number, cx: number, cy: number, R: number): Pt | null {
  const dx = x - cx
  const dy = y - cy
  const d2 = dx * dx + dy * dy
  if (d2 < 1e-12) return null
  const k = (R * R) / d2
  return { x: cx + dx * k, y: cy + dy * k }
}

function invP(p: Pt, O: Pt, R: number): Pt | null {
  return invert(p.x, p.y, O.x, O.y, R)
}

/* ── O 到直线 AB 的垂足、距离、参数 ── */
function footOnLine(A: Pt, B: Pt, O: Pt): { F: Pt; d: number; t: number } {
  const ab = sub(B, A)
  const ab2 = dot(ab, ab) || EPS
  const t = dot(sub(O, A), ab) / ab2
  const F = add(A, scl(ab, t))
  return { F, d: len(sub(O, F)), t }
}

/** 选择从 a0 到 aB 的扫角方向，使其经过 aM（带符号，绝对值 ≤ 2π）。 */
function sweepThrough(a0: number, aM: number, aB: number): number {
  const norm = (x: number) => {
    let v = x % (Math.PI * 2)
    if (v < 0) v += Math.PI * 2
    return v
  }
  const ccw = norm(aB - a0)
  const mCcw = norm(aM - a0)
  return mCcw <= ccw ? ccw : ccw - Math.PI * 2
}

/* ═══════════════════ 解析像 ═══════════════════ */

/** 直线（过 A、B 的无穷直线）的反演像：过圆心则为自身，否则为过圆心的圆。 */
export function imageOfLine(A: Pt, B: Pt, O: Pt, R: number): ImageShape {
  const { F, d } = footOnLine(A, B, O)
  if (d < EPS) return { kind: 'line', p: { ...A }, d: unit(sub(B, A)) }
  const u = sub(F, O) // 长度 = d
  const c = add(O, scl(u, (R * R) / (2 * d * d)))
  const r = (R * R) / (2 * d)
  return { kind: 'circle', c, r }
}

/** 线段的反演像：圆弧 / 子线段 / 双射线（过心）。 */
export function imageOfSegment(A: Pt, B: Pt, O: Pt, R: number): ImageShape {
  const A2 = invP(A, O, R)
  const B2 = invP(B, O, R)
  if (!A2 || !B2) return { kind: 'none' }
  const { F, d, t } = footOnLine(A, B, O)

  if (d < EPS) {
    // 直线过 O：若 O 落在线段内部 → 像为两条射线；否则 → 子线段
    if (t > EPS && t < 1 - EPS) {
      return { kind: 'rays', a: A2, ad: unit(sub(A2, O)), b: B2, bd: unit(sub(B2, O)) }
    }
    return { kind: 'segment', a: A2, b: B2 }
  }

  const u = sub(F, O)
  const c = add(O, scl(u, (R * R) / (2 * d * d)))
  const r = (R * R) / (2 * d)
  const M2 = invP(mid(A, B), O, R) ?? A2
  const a0 = ang(sub(A2, c))
  const aB = ang(sub(B2, c))
  const aM = ang(sub(M2, c))
  return { kind: 'arc', c, r, a0, sweep: sweepThrough(a0, aM, aB) }
}

/** 圆的反演像：过圆心则为直线，否则为圆（圆心在 O 上时为同心圆）。 */
export function imageOfCircle(K: Pt, rho: number, O: Pt, R: number): ImageShape {
  const s = len(sub(K, O))
  if (s < EPS) return { kind: 'circle', c: { ...O }, r: (R * R) / rho } // 同心圆
  if (Math.abs(s - rho) < 1e-6 * Math.max(1, rho)) {
    // O 在圆上 → 像为直线，垂直于 OK，距 O 为 R²/(2ρ)
    const u = unit(sub(K, O))
    const foot = add(O, scl(u, (R * R) / (2 * s)))
    return { kind: 'line', p: foot, d: { x: -u.y, y: u.x } }
  }
  const denom = s * s - rho * rho
  const c = add(O, scl(sub(K, O), (R * R) / denom))
  const r = (R * R * rho) / Math.abs(denom)
  return { kind: 'circle', c, r }
}

/* ═══════════════════ 像的解析描述（侧栏读出） ═══════════════════ */

export interface ImageInfo {
  title: string
  lines: string[]
  /** 是否“穿过反演中心”的特例。 */
  special: boolean
}

const f2 = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(2))
const ptStr = (p: Pt) => `(${f2(p.x)}, ${f2(p.y)})`

export function describeImage(shape: ImageShape): ImageInfo {
  switch (shape.kind) {
    case 'point':
      return { title: '像：点', lines: [`P′ = ${ptStr(shape.p)}`], special: false }
    case 'circle':
      return {
        title: '像：圆',
        lines: [`圆心 ${ptStr(shape.c)}`, `半径 ${f2(shape.r)}`],
        special: false,
      }
    case 'arc':
      return {
        title: '像：圆弧',
        lines: [`所在圆心 ${ptStr(shape.c)}`, `半径 ${f2(shape.r)}`],
        special: false,
      }
    case 'line': {
      // 直线方程 d·(X-p)=0 的法线式：n·X = n·p
      const n = { x: -shape.d.y, y: shape.d.x }
      const c = dot(n, shape.p)
      return {
        title: '像：直线（过反演中心 → 直线）',
        lines: [`${f2(n.x)}·x + ${f2(n.y)}·y = ${f2(c)}`],
        special: true,
      }
    }
    case 'segment':
      return {
        title: '像：线段（与原线段共线、过反演中心的直线上）',
        lines: [`${ptStr(shape.a)} – ${ptStr(shape.b)}`],
        special: true,
      }
    case 'rays':
      return { title: '像：两条射线（线段过反演中心）', lines: ['伸向无穷'], special: true }
    default:
      return { title: '像：无（与反演中心重合）', lines: [], special: true }
  }
}

/* ═══════════════════ 坐标（世界 ↔ 屏幕，Y 翻转） ═══════════════════ */

export function w2s(wx: number, wy: number, view: View, W: number, H: number): Pt {
  return { x: W / 2 + (wx - view.cx) * view.scale, y: H / 2 - (wy - view.cy) * view.scale }
}
export function s2w(sx: number, sy: number, view: View, W: number, H: number): Pt {
  return { x: view.cx + (sx - W / 2) / view.scale, y: view.cy - (sy - H / 2) / view.scale }
}

/* ═══════════════════ 圆弧采样（世界坐标） ═══════════════════ */

/** 把圆弧 {c,r,a0,sweep} 采样为世界坐标点序列。 */
export function sampleArc(c: Pt, r: number, a0: number, sweep: number, N = 96): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const a = a0 + (sweep * i) / N
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) })
  }
  return out
}

/* ═══════════════════ 直线/射线裁剪到屏幕矩形（Liang–Barsky） ═══════════════════ */

/**
 * 把屏幕坐标下、过 p 沿方向 d 的（半）直线裁剪到 [0,W]×[0,H]。
 * tMin/tMax 给定参数范围（直线用 ±∞，射线用 [0,∞)）。返回可见线段端点或 null。
 */
export function clipRay(
  p: Pt,
  d: Pt,
  W: number,
  H: number,
  tMin = -1e9,
  tMax = 1e9,
): [Pt, Pt] | null {
  // Liang–Barsky：参数线 p + t·d 裁剪到 [0,W]×[0,H]。
  let t0 = tMin
  let t1 = tMax
  const P = [-d.x, d.x, -d.y, d.y]
  const Q = [p.x, W - p.x, p.y, H - p.y]
  for (let k = 0; k < 4; k++) {
    if (Math.abs(P[k]) < 1e-12) {
      if (Q[k] < 0) return null // 平行且在边界外
      continue
    }
    const t = Q[k] / P[k]
    if (P[k] < 0) {
      if (t > t1) return null
      if (t > t0) t0 = t
    } else {
      if (t < t0) return null
      if (t < t1) t1 = t
    }
  }
  if (t0 > t1) return null
  return [
    { x: p.x + d.x * t0, y: p.y + d.y * t0 },
    { x: p.x + d.x * t1, y: p.y + d.y * t1 },
  ]
}

/* ═══════════════════ 网格 / 视图 ═══════════════════ */

export function gridStep(scale: number): number {
  return scale > 60 ? 0.5 : scale > 30 ? 1 : scale > 12 ? 2 : 5
}

export function fitView(cx: number, cy: number, R: number, W: number, H: number): View {
  let scale = Math.min(W, H) / (R * 4)
  scale = Math.max(10, Math.min(150, scale))
  return { cx, cy, scale }
}
