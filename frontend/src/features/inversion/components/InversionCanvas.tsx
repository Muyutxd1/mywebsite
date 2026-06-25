import { useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import {
  fitView as computeFitView,
  gridStep,
  invert,
  s2w,
  w2s,
  sampleInvertedCircle,
  sampleInvertedSegment,
} from '../lib/inversionMath'
import type { Pt, View } from '../lib/inversionMath'
import type { Constructing, Drag, SceneObject, Selection, Tool } from '../types'

/** Brand-aligned dark-canvas palette (deep-space ink + light). */
const C = {
  orig: '#5aa9ff', // info blue — original
  inv: '#f0616d', // danger red — inverted
  invCircle: '#a78bff', // accent violet — inversion circle
  center: '#f0616d',
  select: '#e7b455', // gold selection glow
  bg: '#0a0b12',
  grid: 'rgba(122,130,150,0.12)',
  axis: 'rgba(150,156,176,0.55)',
  tick: '#6a7187',
  origin: '#969cb0',
  ray: 'rgba(150,156,176,0.10)',
}

export interface CanvasState {
  cx: number
  cy: number
  R: number
  objects: SceneObject[]
  view: View
  tool: Tool
  selected: Selection
  drag: Drag
  constructing: Constructing
  nextId: number
}

export interface InversionHandle {
  /** Force a redraw (e.g. after external slider input). */
  redraw: () => void
  /** Re-fit the view around the inversion circle. */
  fit: () => void
  /** Delete the current selection. */
  deleteSelected: () => void
  /** Clear all scene objects. */
  clearAll: () => void
  /** Read a live snapshot of cx/cy/R for the sidebar. */
  getCircle: () => { cx: number; cy: number; R: number }
  /** Push cx/cy/R into the live engine (slider two-way sync). */
  setCircle: (cx: number, cy: number, R: number) => void
}

interface Props {
  /** Imperative handle. */
  handleRef: Ref<InversionHandle>
  /** Called whenever cx/cy/R change from canvas interaction (drag/place). */
  onCircleChange: (c: { cx: number; cy: number; R: number }) => void
  /** Called when selection changes (so sidebar Delete can reflect state). */
  onSelectionChange?: (hasSelection: boolean) => void
  /** Live tool (kept in a ref to avoid stale closures). */
  tool: Tool
  /** Set tool from canvas (e.g. Escape / keyboard). */
  onToolChange: (t: Tool) => void
}

export function InversionCanvas({
  handleRef,
  onCircleChange,
  onSelectionChange,
  tool,
  onToolChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  // CSS pixel dimensions (world math uses these; DPR scaling applied separately).
  const sizeRef = useRef({ W: 800, H: 500, dpr: 1 })
  const rafRef = useRef<number | null>(null)

  // ── Live engine state via ref (hot-path reads avoid stale closures) ──
  const sRef = useRef<CanvasState>({
    cx: 0,
    cy: 0,
    R: 2,
    objects: [],
    view: { cx: 0, cy: 0, scale: 40 },
    tool: 'invCenter',
    selected: null,
    drag: null,
    constructing: null,
    nextId: 1,
  })

  // Keep tool ref in sync with prop.
  useEffect(() => {
    sRef.current.tool = tool
    sRef.current.selected = null
    sRef.current.constructing = null
    scheduleDraw()
    onSelectionChange?.(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool])

  /* ═══════════════════ COORD HELPERS (live W/H/view) ═══════════════════ */

  const W = () => sizeRef.current.W
  const H = () => sizeRef.current.H
  const toScreen = (wx: number, wy: number) => w2s(wx, wy, sRef.current.view, W(), H())
  const toWorld = (sx: number, sy: number) => s2w(sx, sy, sRef.current.view, W(), H())

  function evScreen(e: { clientX: number; clientY: number }): Pt {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (W() / r.width),
      y: (e.clientY - r.top) * (H() / r.height),
    }
  }
  function evWorld(e: { clientX: number; clientY: number }): Pt {
    const sc = evScreen(e)
    return toWorld(sc.x, sc.y)
  }

  /* ═══════════════════ HIT TEST ═══════════════════ */

  function hitTest(world: Pt, screen: Pt): Selection {
    const s = sRef.current
    const thr = 12 / s.view.scale

    const cS = toScreen(s.cx, s.cy)
    const hx = cS.x + s.R * s.view.scale
    const hy = cS.y
    if (Math.hypot(screen.x - hx, screen.y - hy) < 14) return { type: 'invRadius' }
    if (Math.hypot(screen.x - cS.x, screen.y - cS.y) < 12) return { type: 'invCenter' }

    for (let i = s.objects.length - 1; i >= 0; i--) {
      const o = s.objects[i]
      if (o.type === 'point' && Math.hypot(world.x - o.x, world.y - o.y) < thr)
        return { type: 'object', objId: o.id }
      if (o.type === 'segment') {
        if (Math.hypot(world.x - o.p1.x, world.y - o.p1.y) < thr)
          return { type: 'object', objId: o.id, sub: 'p1' }
        if (Math.hypot(world.x - o.p2.x, world.y - o.p2.y) < thr)
          return { type: 'object', objId: o.id, sub: 'p2' }
      }
      if (o.type === 'circle' && Math.hypot(world.x - o.center.x, world.y - o.center.y) < thr)
        return { type: 'object', objId: o.id, sub: 'center' }
    }
    return null
  }

  /* ═══════════════════ DRAWING ═══════════════════ */

  function scheduleDraw() {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      drawAll()
    })
  }

  function drawGrid(ctx: CanvasRenderingContext2D) {
    const s = sRef.current
    const w = W()
    const h = H()
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, w, h)

    const tl = toWorld(0, 0)
    const br = toWorld(w, h)
    const xMin = Math.floor(Math.min(tl.x, br.x))
    const xMax = Math.ceil(Math.max(tl.x, br.x))
    const yMin = Math.floor(Math.min(tl.y, br.y))
    const yMax = Math.ceil(Math.max(tl.y, br.y))
    const step = gridStep(s.view.scale)

    ctx.strokeStyle = C.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = Math.floor(xMin / step) * step; x <= xMax; x += step) {
      const p = toScreen(x, 0)
      ctx.moveTo(p.x, 0)
      ctx.lineTo(p.x, h)
    }
    for (let y = Math.floor(yMin / step) * step; y <= yMax; y += step) {
      const p = toScreen(0, y)
      ctx.moveTo(0, p.y)
      ctx.lineTo(w, p.y)
    }
    ctx.stroke()

    const O = toScreen(0, 0)
    ctx.strokeStyle = C.axis
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(0, O.y)
    ctx.lineTo(w, O.y)
    ctx.moveTo(O.x, 0)
    ctx.lineTo(O.x, h)
    ctx.stroke()

    const mstep = step < 1 ? 1 : step * 2
    ctx.fillStyle = C.tick
    ctx.font = '10px ui-monospace, monospace'
    for (let x = Math.ceil(xMin); x <= xMax; x += mstep) {
      if (x === 0) continue
      const p = toScreen(x, 0)
      ctx.textAlign = 'center'
      ctx.fillText(String(x), p.x, Math.min(h - 2, O.y + 14))
    }
    for (let y = Math.ceil(yMin); y <= yMax; y += mstep) {
      if (y === 0) continue
      const p = toScreen(0, y)
      ctx.textAlign = 'right'
      ctx.fillText(String(y), Math.max(2, O.x - 6), p.y + 4)
    }
    ctx.fillStyle = C.origin
    ctx.font = 'bold 11px ui-monospace, monospace'
    ctx.textAlign = 'right'
    ctx.fillText('O', O.x - 8, O.y + 14)
  }

  function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.5)
    g.addColorStop(0, color)
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r * 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  function dot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
    selected: boolean,
  ) {
    const s = toScreen(x, y)
    if (selected) glow(ctx, s.x, s.y, r, C.select)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0a0b12'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  function drawSegment(ctx: CanvasRenderingContext2D, p1: Pt, p2: Pt, color: string, width: number) {
    const a = toScreen(p1.x, p1.y)
    const b = toScreen(p2.x, p2.y)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  function drawPolyline(ctx: CanvasRenderingContext2D, samples: (Pt | null)[]) {
    ctx.strokeStyle = C.inv
    ctx.lineWidth = 2.5
    ctx.beginPath()
    let started = false
    for (const p of samples) {
      if (!p) {
        started = false
        continue
      }
      const sc = toScreen(p.x, p.y)
      if (!started) {
        ctx.moveTo(sc.x, sc.y)
        started = true
      } else {
        ctx.lineTo(sc.x, sc.y)
      }
    }
    ctx.stroke()
  }

  function drawCircleWorld(
    ctx: CanvasRenderingContext2D,
    center: Pt,
    radius: number,
    color: string,
  ) {
    const sc = toScreen(center.x, center.y)
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(sc.x, sc.y, radius * sRef.current.view.scale, 0, Math.PI * 2)
    ctx.stroke()
  }

  function drawAll() {
    const ctx = ctxRef.current
    if (!ctx) return
    const s = sRef.current
    const w = W()
    const h = H()
    ctx.clearRect(0, 0, w, h)
    drawGrid(ctx)

    // Inversion circle (dashed violet)
    const cS = toScreen(s.cx, s.cy)
    const rPx = s.R * s.view.scale
    ctx.strokeStyle = C.invCircle
    ctx.lineWidth = 2
    ctx.setLineDash([6, 3])
    ctx.beginPath()
    ctx.arc(cS.x, cS.y, rPx, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Center dot
    const cSel = s.selected?.type === 'invCenter'
    dot(ctx, s.cx, s.cy, cSel ? 7 : 5, C.center, cSel)

    // Radius handle (violet)
    const hx = cS.x + rPx
    const hy = cS.y
    const rSel = s.selected?.type === 'invRadius'
    if (rSel) glow(ctx, hx, hy, 6, C.select)
    ctx.fillStyle = rSel ? C.inv : C.invCircle
    ctx.beginPath()
    ctx.arc(hx, hy, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0a0b12'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Objects
    for (const o of s.objects) {
      const sel = !!(
        s.selected &&
        s.selected.type === 'object' &&
        s.selected.objId === o.id
      )
      const selSub = sel && s.selected?.type === 'object' ? s.selected.sub : undefined
      switch (o.type) {
        case 'point': {
          // Faint full-length ray through the point from the center.
          const ps = toScreen(o.x, o.y)
          ctx.strokeStyle = C.ray
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(cS.x, cS.y)
          const dx = ps.x - cS.x
          const dy = ps.y - cS.y
          const L = Math.sqrt(dx * dx + dy * dy) || 1
          ctx.lineTo(ps.x + (dx / L) * 2000, ps.y + (dy / L) * 2000)
          ctx.stroke()

          dot(ctx, o.x, o.y, sel ? 7 : 5, C.orig, sel)
          const inv = invert(o.x, o.y, s.cx, s.cy, s.R)
          if (inv) dot(ctx, inv.x, inv.y, 4, C.inv, false)
          break
        }
        case 'segment':
          drawSegment(ctx, o.p1, o.p2, C.orig, sel ? 3.5 : 2.5)
          drawPolyline(ctx, sampleInvertedSegment(o.p1, o.p2, s.cx, s.cy, s.R))
          dot(ctx, o.p1.x, o.p1.y, selSub === 'p1' ? 7 : 5, C.orig, selSub === 'p1')
          dot(ctx, o.p2.x, o.p2.y, selSub === 'p2' ? 7 : 5, C.orig, selSub === 'p2')
          break
        case 'circle':
          drawCircleWorld(ctx, o.center, o.radius, C.orig)
          drawPolyline(ctx, sampleInvertedCircle(o.center, o.radius, s.cx, s.cy, s.R))
          dot(ctx, o.center.x, o.center.y, selSub === 'center' ? 7 : 5, C.orig, selSub === 'center')
          break
      }
    }

    // Construction preview
    if (s.constructing) {
      if ('p1' in s.constructing) dot(ctx, s.constructing.p1.x, s.constructing.p1.y, 5, C.orig, false)
      else if ('center' in s.constructing)
        dot(ctx, s.constructing.center.x, s.constructing.center.y, 5, C.orig, false)
    }
  }

  /* ═══════════════════ ACTIONS ═══════════════════ */

  function emitCircle() {
    const s = sRef.current
    onCircleChange({ cx: s.cx, cy: s.cy, R: s.R })
  }

  function deleteSelected() {
    const s = sRef.current
    if (!s.selected) return
    if (s.selected.type === 'object') {
      const id = s.selected.objId
      s.objects = s.objects.filter((o) => o.id !== id)
    }
    s.selected = null
    s.constructing = null
    onSelectionChange?.(false)
    scheduleDraw()
  }

  function clearAll() {
    const s = sRef.current
    s.objects = []
    s.selected = null
    s.constructing = null
    onSelectionChange?.(false)
    scheduleDraw()
  }

  function fit() {
    const s = sRef.current
    s.view = computeFitView(s.cx, s.cy, s.R, W(), H())
    scheduleDraw()
  }

  /* ═══════════════════ POINTER EVENTS ═══════════════════ */

  // Pinch-zoom tracking.
  const pointers = useRef<Map<number, Pt>>(new Map())
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)

  function onPointerDown(e: PointerEvent) {
    const canvas = canvasRef.current!
    canvas.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Two fingers → begin pinch (cancel any single-pointer drag).
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      pinchRef.current = { dist, scale: sRef.current.view.scale }
      sRef.current.drag = null
      return
    }

    const s = sRef.current
    if (e.button === 2) {
      s.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, scx: s.view.cx, scy: s.view.cy }
      return
    }
    if (e.button !== 0) return

    const world = evWorld(e)
    const screen = evScreen(e)
    const hit = hitTest(world, screen)

    if (s.tool === 'select') {
      if (hit) {
        s.selected = hit
        if (hit.type === 'invRadius') s.drag = { type: 'resizeRadius' }
        else if (hit.type === 'invCenter') s.drag = { type: 'moveInvCenter' }
        else if (hit.type === 'object')
          s.drag = { type: 'moveVertex', objId: hit.objId, sub: hit.sub }
        onSelectionChange?.(hit.type === 'object')
      } else {
        s.selected = null
        s.constructing = null
        s.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, scx: s.view.cx, scy: s.view.cy }
        onSelectionChange?.(false)
      }
      scheduleDraw()
      return
    }

    if (s.tool === 'point') {
      const id = s.nextId++
      const label = String.fromCharCode(65 + ((id - 1) % 26))
      s.objects.push({ type: 'point', id, x: world.x, y: world.y, label })
      s.selected = { type: 'object', objId: id }
      onSelectionChange?.(true)
      scheduleDraw()
      return
    }

    if (s.tool === 'segment') {
      if (!s.constructing) {
        s.constructing = { p1: { x: world.x, y: world.y } }
      } else if ('p1' in s.constructing) {
        const id = s.nextId++
        s.objects.push({
          type: 'segment',
          id,
          p1: { ...s.constructing.p1 },
          p2: { x: world.x, y: world.y },
          label1: String.fromCharCode(65 + ((id * 2 - 1) % 26)),
          label2: String.fromCharCode(65 + ((id * 2) % 26)),
        })
        s.selected = { type: 'object', objId: id }
        s.constructing = null
        onSelectionChange?.(true)
      }
      scheduleDraw()
      return
    }

    if (s.tool === 'circle') {
      if (!s.constructing) {
        s.constructing = { center: { x: world.x, y: world.y } }
      } else if ('center' in s.constructing) {
        const id = s.nextId++
        const r = Math.hypot(
          world.x - s.constructing.center.x,
          world.y - s.constructing.center.y,
        )
        s.objects.push({ type: 'circle', id, center: { ...s.constructing.center }, radius: r })
        s.selected = { type: 'object', objId: id, sub: 'center' }
        s.constructing = null
        onSelectionChange?.(true)
      }
      scheduleDraw()
      return
    }

    if (s.tool === 'invCenter') {
      s.cx = world.x
      s.cy = world.y
      s.selected = { type: 'invRadius' }
      s.drag = { type: 'resizeRadius' }
      emitCircle()
      onSelectionChange?.(false)
      scheduleDraw()
      return
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Pinch-zoom (two pointers).
    if (pointers.current.size === 2 && pinchRef.current) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      let scale = (pinchRef.current.scale * dist) / (pinchRef.current.dist || 1)
      scale = Math.max(5, Math.min(200, scale))
      sRef.current.view.scale = scale
      scheduleDraw()
      return
    }

    const s = sRef.current
    const world = evWorld(e)
    const screen = evScreen(e)

    if (s.drag) {
      if (s.drag.type === 'pan') {
        const dx = (e.clientX - s.drag.sx) / s.view.scale
        const dy = (e.clientY - s.drag.sy) / s.view.scale
        s.view.cx = s.drag.scx - dx
        s.view.cy = s.drag.scy + dy
      } else if (s.drag.type === 'resizeRadius') {
        s.R = Math.max(0.2, Math.hypot(world.x - s.cx, world.y - s.cy))
        emitCircle()
      } else if (s.drag.type === 'moveInvCenter') {
        s.cx = world.x
        s.cy = world.y
        emitCircle()
      } else if (s.drag.type === 'moveVertex') {
        const drag = s.drag
        const obj = s.objects.find((o) => o.id === drag.objId)
        if (!obj) return
        const sub = drag.sub
        if (obj.type === 'point') {
          obj.x = world.x
          obj.y = world.y
        } else if (obj.type === 'segment' && sub === 'p1') {
          obj.p1.x = world.x
          obj.p1.y = world.y
        } else if (obj.type === 'segment' && sub === 'p2') {
          obj.p2.x = world.x
          obj.p2.y = world.y
        } else if (obj.type === 'circle' && sub === 'center') {
          obj.center.x = world.x
          obj.center.y = world.y
        }
      }
      scheduleDraw()
      return
    }

    // Hover cursor.
    const hit = hitTest(world, screen)
    const canvas = canvasRef.current!
    canvas.style.cursor = hit
      ? s.tool === 'select'
        ? 'grab'
        : 'pointer'
      : s.tool === 'select'
        ? ''
        : 'crosshair'
  }

  function onPointerUp(e: PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchRef.current = null
    sRef.current.drag = null
    scheduleDraw()
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const s = sRef.current
    const zoom = e.deltaY < 0 ? 1.15 : 1 / 1.15
    s.view.scale = Math.max(5, Math.min(200, s.view.scale * zoom))
    scheduleDraw()
  }

  /* ═══════════════════ KEYBOARD ═══════════════════ */

  function onKeyDown(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        deleteSelected()
        break
      case 'Escape':
        sRef.current.selected = null
        sRef.current.constructing = null
        onSelectionChange?.(false)
        onToolChange('select')
        break
      case 'v':
      case 'V':
        onToolChange('select')
        break
      case 'p':
      case 'P':
        onToolChange('point')
        break
      case 's':
      case 'S':
        onToolChange('segment')
        break
      case 'c':
      case 'C':
        onToolChange('circle')
        break
      case 'i':
      case 'I':
        onToolChange('invCenter')
        break
      case 'f':
      case 'F':
        fit()
        break
    }
  }

  /* ═══════════════════ RESIZE / DPR ═══════════════════ */

  function resize() {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    const rect = parent?.getBoundingClientRect()
    const W0 = Math.max(1, Math.round(rect?.width || 800))
    const H0 = Math.max(1, Math.round(rect?.height || 500))
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    sizeRef.current = { W: W0, H: H0, dpr }
    canvas.width = Math.round(W0 * dpr)
    canvas.height = Math.round(H0 * dpr)
    canvas.style.width = W0 + 'px'
    canvas.style.height = H0 + 'px'
    const ctx = canvas.getContext('2d')
    ctxRef.current = ctx
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    scheduleDraw()
  }

  /* ═══════════════════ IMPERATIVE HANDLE ═══════════════════ */

  useImperativeHandle(
    handleRef,
    (): InversionHandle => ({
      redraw: () => scheduleDraw(),
      fit: () => fit(),
      deleteSelected: () => deleteSelected(),
      clearAll: () => clearAll(),
      getCircle: () => {
        const s = sRef.current
        return { cx: s.cx, cy: s.cy, R: s.R }
      },
      setCircle: (cx: number, cy: number, R: number) => {
        const s = sRef.current
        s.cx = cx
        s.cy = cy
        s.R = R
        scheduleDraw()
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  /* ═══════════════════ MOUNT ═══════════════════ */

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    ctxRef.current = canvas.getContext('2d')
    resize()
    // initial fit
    fit()

    const ro = new ResizeObserver(() => resize())
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    const noCtx = (e: Event) => e.preventDefault()
    canvas.addEventListener('contextmenu', noCtx)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', noCtx)
      window.removeEventListener('keydown', onKeyDown)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full touch-none rounded-xl"
      style={{ touchAction: 'none' }}
    />
  )
}
