/**
 * Inversion Workbench — pure geometry/engine module (no React).
 * Ported VERBATIM from _legacy/static/js/inversion.js to preserve behavior
 * and any saved data: same coordinate conventions, transform order, sampling.
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

/* ═══════════════════ MATH ═══════════════════ */

/**
 * Circle inversion of point (x,y) through circle centered (cx,cy) radius R.
 * Returns null when the point coincides with the center (d^2 ~ 0).
 *   k = R^2 / d^2 ; result = (cx + dx*k, cy + dy*k)
 */
export function invert(x: number, y: number, cx: number, cy: number, R: number): Pt | null {
  const dx = x - cx
  const dy = y - cy
  const d2 = dx * dx + dy * dy
  if (d2 < 1e-10) return null
  const k = (R * R) / d2
  return { x: cx + dx * k, y: cy + dy * k }
}

/* ═══════════════════ COORDS (world ↔ screen, Y-FLIP) ═══════════════════ */

export function w2s(wx: number, wy: number, view: View, W: number, H: number): Pt {
  return {
    x: W / 2 + (wx - view.cx) * view.scale,
    y: H / 2 - (wy - view.cy) * view.scale,
  }
}

export function s2w(sx: number, sy: number, view: View, W: number, H: number): Pt {
  return {
    x: view.cx + (sx - W / 2) / view.scale,
    y: view.cy - (sy - H / 2) / view.scale,
  }
}

/* ═══════════════════ SAMPLING ═══════════════════ */

/**
 * Sample the inverted image of segment p1→p2 (N=100 points, inclusive),
 * pointwise mapped. Null samples (center hits) break the polyline.
 */
export function sampleInvertedSegment(
  p1: Pt,
  p2: Pt,
  cx: number,
  cy: number,
  R: number,
  N = 100,
): (Pt | null)[] {
  const out: (Pt | null)[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    out.push(invert(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t, cx, cy, R))
  }
  return out
}

/**
 * Sample the inverted image of a circle (N=120 points, inclusive),
 * pointwise mapped. Null samples (center hits) break the polyline.
 */
export function sampleInvertedCircle(
  center: Pt,
  radius: number,
  cx: number,
  cy: number,
  R: number,
  N = 120,
): (Pt | null)[] {
  const out: (Pt | null)[] = []
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    out.push(invert(center.x + radius * Math.cos(a), center.y + radius * Math.sin(a), cx, cy, R))
  }
  return out
}

/* ═══════════════════ GRID ═══════════════════ */

/** Adaptive grid step by zoom level: 0.5 / 1 / 2 / 5. */
export function gridStep(scale: number): number {
  return scale > 60 ? 0.5 : scale > 30 ? 1 : scale > 12 ? 2 : 5
}

/* ═══════════════════ VIEW FIT ═══════════════════ */

/** Frame ~4R around the inversion circle (clamped to [10,150]). */
export function fitView(cx: number, cy: number, R: number, W: number, H: number): View {
  let scale = Math.min(W, H) / (R * 4)
  scale = Math.max(10, Math.min(150, scale))
  return { cx, cy, scale }
}
