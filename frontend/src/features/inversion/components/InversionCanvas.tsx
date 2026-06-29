import { useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import {
  clipRay,
  describeImage,
  fitView as computeFitView,
  gridStep,
  imageOfCircle,
  imageOfLine,
  imageOfSegment,
  invert,
  s2w,
  sampleArc,
  w2s,
} from '../lib/inversionMath'
import type { ImageShape, Pt, View } from '../lib/inversionMath'
import type { Constructing, Drag, SceneObject, Selection, SelectionInfo, Tool } from '../types'

const C = {
  orig: '#5aa9ff', // 原象（蓝）
  inv: '#f0616d', // 反演像（红）
  special: '#e7b455', // 穿心特例（金）
  invCircle: '#a78bff', // 反演圆（紫）
  select: '#e7b455',
  bg: '#0a0b12',
  grid: 'rgba(122,130,150,0.12)',
  axis: 'rgba(150,156,176,0.5)',
  tick: '#6a7187',
  origin: '#969cb0',
  conj: 'rgba(231,180,85,0.45)', // 共轭连线
}

function distToLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L = Math.hypot(dx, dy) || 1
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / L
}
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L2 = dx * dx + dy * dy || 1
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

interface CanvasState {
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
  fit: () => void
  deleteSelected: () => void
  clearAll: () => void
  setCircle: (cx: number, cy: number, R: number) => void
}

interface Props {
  handleRef: Ref<InversionHandle>
  onCircleChange: (c: { cx: number; cy: number; R: number }) => void
  onSelectionChange?: (hasSelection: boolean) => void
  onSelectionInfo?: (info: SelectionInfo | null) => void
  tool: Tool
  onToolChange: (t: Tool) => void
}

export function InversionCanvas({
  handleRef,
  onCircleChange,
  onSelectionChange,
  onSelectionInfo,
  tool,
  onToolChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef({ W: 800, H: 500, dpr: 1 })
  const rafRef = useRef<number | null>(null)
  const lastInfoRef = useRef<string>('')

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

  useEffect(() => {
    sRef.current.tool = tool
    sRef.current.selected = null
    sRef.current.constructing = null
    onSelectionChange?.(false)
    emitInfo(null)
    scheduleDraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool])

  const W = () => sizeRef.current.W
  const H = () => sizeRef.current.H
  const O = (): Pt => ({ x: sRef.current.cx, y: sRef.current.cy })
  const toScreen = (wx: number, wy: number) => w2s(wx, wy, sRef.current.view, W(), H())
  const toWorld = (sx: number, sy: number) => s2w(sx, sy, sRef.current.view, W(), H())

  function evScreen(e: { clientX: number; clientY: number }): Pt {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (W() / r.width), y: (e.clientY - r.top) * (H() / r.height) }
  }
  const evWorld = (e: { clientX: number; clientY: number }) => {
    const sc = evScreen(e)
    return toWorld(sc.x, sc.y)
  }

  /* ── 命中检测 ── */
  function hitTest(world: Pt, screen: Pt): Selection {
    const s = sRef.current
    const thr = 12 / s.view.scale
    const cS = toScreen(s.cx, s.cy)
    // 半径手柄离圆心太近（圆很小）时跳过，免得永远盖住圆心、无法选中反演中心。
    if (s.R * s.view.scale >= 24 && Math.hypot(screen.x - (cS.x + s.R * s.view.scale), screen.y - cS.y) < 14)
      return { type: 'invRadius' }
    if (Math.hypot(screen.x - cS.x, screen.y - cS.y) < 12) return { type: 'invCenter' }
    // 先匹配控制点（可拖动），再匹配图形本体（仅可选中/删除）。
    for (let i = s.objects.length - 1; i >= 0; i--) {
      const o = s.objects[i]
      if (o.type === 'point' && Math.hypot(world.x - o.x, world.y - o.y) < thr) return { type: 'object', objId: o.id }
      if (o.type === 'segment' || o.type === 'line') {
        if (Math.hypot(world.x - o.p1.x, world.y - o.p1.y) < thr) return { type: 'object', objId: o.id, sub: 'p1' }
        if (Math.hypot(world.x - o.p2.x, world.y - o.p2.y) < thr) return { type: 'object', objId: o.id, sub: 'p2' }
      }
      if (o.type === 'circle' && Math.hypot(world.x - o.center.x, world.y - o.center.y) < thr)
        return { type: 'object', objId: o.id, sub: 'center' }
    }
    for (let i = s.objects.length - 1; i >= 0; i--) {
      const o = s.objects[i]
      if (o.type === 'line' && distToLine(world, o.p1, o.p2) < thr) return { type: 'object', objId: o.id }
      if (o.type === 'segment' && distToSegment(world, o.p1, o.p2) < thr) return { type: 'object', objId: o.id }
      if (o.type === 'circle' && Math.abs(Math.hypot(world.x - o.center.x, world.y - o.center.y) - o.radius) < thr)
        return { type: 'object', objId: o.id }
    }
    return null
  }

  /* ── 绘制 ── */
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
    const Os = toScreen(0, 0)
    ctx.strokeStyle = C.axis
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(0, Os.y)
    ctx.lineTo(w, Os.y)
    ctx.moveTo(Os.x, 0)
    ctx.lineTo(Os.x, h)
    ctx.stroke()
    const mstep = step < 1 ? 1 : step * 2
    ctx.fillStyle = C.tick
    ctx.font = '10px ui-monospace, monospace'
    for (let x = Math.ceil(xMin / mstep) * mstep; x <= xMax; x += mstep) {
      if (x === 0) continue
      const p = toScreen(x, 0)
      ctx.textAlign = 'center'
      ctx.fillText(String(x), p.x, Math.min(h - 2, Os.y + 14))
    }
    for (let y = Math.ceil(yMin / mstep) * mstep; y <= yMax; y += mstep) {
      if (y === 0) continue
      const p = toScreen(0, y)
      ctx.textAlign = 'right'
      ctx.fillText(String(y), Math.max(2, Os.x - 6), p.y + 4)
    }
  }

  function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.5)
    g.addColorStop(0, C.select)
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r * 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  function dot(ctx: CanvasRenderingContext2D, world: Pt, r: number, color: string, selected = false) {
    const p = toScreen(world.x, world.y)
    if (selected) glow(ctx, p.x, p.y, r)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = C.bg
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  function strokeScreenSeg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, w: number, dash?: number[]) {
    ctx.strokeStyle = color
    ctx.lineWidth = w
    if (dash) ctx.setLineDash(dash)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    if (dash) ctx.setLineDash([])
  }

  function strokeWorldPolyline(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, w: number) {
    ctx.strokeStyle = color
    ctx.lineWidth = w
    ctx.beginPath()
    pts.forEach((p, i) => {
      const sc = toScreen(p.x, p.y)
      if (i === 0) ctx.moveTo(sc.x, sc.y)
      else ctx.lineTo(sc.x, sc.y)
    })
    ctx.stroke()
  }

  function strokeCircleWorld(ctx: CanvasRenderingContext2D, c: Pt, r: number, color: string, w: number, dash?: number[]) {
    const rpx = r * sRef.current.view.scale
    if (dash) ctx.setLineDash(dash)
    if (rpx < 6000) {
      const sc = toScreen(c.x, c.y)
      ctx.strokeStyle = color
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.arc(sc.x, sc.y, rpx, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      // 半径极大：采样多边形（canvas 自动裁剪），避免巨圆渲染失真
      const pts: Pt[] = []
      for (let i = 0; i <= 360; i++) {
        const a = (i / 360) * Math.PI * 2
        pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) })
      }
      strokeWorldPolyline(ctx, pts, color, w)
    }
    if (dash) ctx.setLineDash([])
  }

  /** 把无穷直线 / 射线裁剪到屏幕后绘制。 */
  function strokeLineWorld(ctx: CanvasRenderingContext2D, p: Pt, d: Pt, color: string, w: number, fromZero = false) {
    const ps = toScreen(p.x, p.y)
    const p2 = toScreen(p.x + d.x, p.y + d.y)
    const ds = { x: p2.x - ps.x, y: p2.y - ps.y }
    const seg = clipRay(ps, ds, W(), H(), fromZero ? 0 : -1e9, 1e9)
    if (seg) strokeScreenSeg(ctx, seg[0], seg[1], color, w)
  }

  function drawImageShape(ctx: CanvasRenderingContext2D, shape: ImageShape) {
    const col = describeImage(shape).special ? C.special : C.inv
    const W2 = 2.5
    switch (shape.kind) {
      case 'point':
        dot(ctx, shape.p, 4, col)
        break
      case 'segment':
        strokeScreenSeg(ctx, toScreen(shape.a.x, shape.a.y), toScreen(shape.b.x, shape.b.y), col, W2)
        break
      case 'rays':
        strokeLineWorld(ctx, shape.a, shape.ad, col, W2, true)
        strokeLineWorld(ctx, shape.b, shape.bd, col, W2, true)
        break
      case 'arc':
        strokeWorldPolyline(ctx, sampleArc(shape.c, shape.r, shape.a0, shape.sweep), col, W2)
        break
      case 'circle':
        strokeCircleWorld(ctx, shape.c, shape.r, col, W2)
        break
      case 'line':
        strokeLineWorld(ctx, shape.p, shape.d, col, W2)
        break
    }
  }

  function drawAll() {
    const ctx = ctxRef.current
    if (!ctx) return
    const s = sRef.current
    ctx.clearRect(0, 0, W(), H())
    drawGrid(ctx)

    const Op = O()
    const cS = toScreen(s.cx, s.cy)
    const rPx = s.R * s.view.scale

    // 反演圆（紫色虚线）
    ctx.strokeStyle = C.invCircle
    ctx.lineWidth = 2
    ctx.setLineDash([6, 3])
    ctx.beginPath()
    ctx.arc(cS.x, cS.y, rPx, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // 像（先画，置于原象之下）
    for (const o of s.objects) {
      if (o.type === 'point') {
        const p = invert(o.x, o.y, s.cx, s.cy, s.R)
        if (p) drawImageShape(ctx, { kind: 'point', p })
      } else if (o.type === 'segment') {
        drawImageShape(ctx, imageOfSegment(o.p1, o.p2, Op, s.R))
      } else if (o.type === 'line') {
        drawImageShape(ctx, imageOfLine(o.p1, o.p2, Op, s.R))
      } else {
        drawImageShape(ctx, imageOfCircle(o.center, o.radius, Op, s.R))
      }
    }

    // 原象
    for (const o of s.objects) {
      const sel = !!(s.selected && s.selected.type === 'object' && s.selected.objId === o.id)
      const sub = sel && s.selected?.type === 'object' ? s.selected.sub : undefined
      switch (o.type) {
        case 'point': {
          // 共轭连线 O–P–P′
          const inv = invert(o.x, o.y, s.cx, s.cy, s.R)
          if (inv) strokeScreenSeg(ctx, cS, toScreen(inv.x, inv.y), C.conj, 1)
          dot(ctx, o, sel ? 7 : 5, C.orig, sel)
          break
        }
        case 'segment':
          strokeScreenSeg(ctx, toScreen(o.p1.x, o.p1.y), toScreen(o.p2.x, o.p2.y), C.orig, sel ? 3.5 : 2.5)
          dot(ctx, o.p1, sub === 'p1' ? 7 : 5, C.orig, sub === 'p1')
          dot(ctx, o.p2, sub === 'p2' ? 7 : 5, C.orig, sub === 'p2')
          break
        case 'line': {
          const d = { x: o.p2.x - o.p1.x, y: o.p2.y - o.p1.y }
          strokeLineWorld(ctx, o.p1, d, C.orig, sel ? 3 : 2)
          dot(ctx, o.p1, sub === 'p1' ? 7 : 5, C.orig, sub === 'p1')
          dot(ctx, o.p2, sub === 'p2' ? 7 : 5, C.orig, sub === 'p2')
          break
        }
        case 'circle':
          strokeCircleWorld(ctx, o.center, o.radius, C.orig, sel ? 3 : 2.5)
          dot(ctx, o.center, sub === 'center' ? 7 : 5, C.orig, sub === 'center')
          break
      }
    }

    // 反演中心 + 半径手柄
    const cSel = s.selected?.type === 'invCenter'
    dot(ctx, Op, cSel ? 7 : 5, C.inv, cSel)
    const rSel = s.selected?.type === 'invRadius'
    if (rSel) glow(ctx, cS.x + rPx, cS.y, 6)
    ctx.fillStyle = rSel ? C.inv : C.invCircle
    ctx.beginPath()
    ctx.arc(cS.x + rPx, cS.y, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = C.bg
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 构造预览
    if (s.constructing) {
      if ('p1' in s.constructing) dot(ctx, s.constructing.p1, 5, C.orig)
      else if ('center' in s.constructing) dot(ctx, s.constructing.center, 5, C.orig)
    }

    emitSelInfo()
  }

  /* ── 动作 ── */
  function emitCircle() {
    const s = sRef.current
    onCircleChange({ cx: s.cx, cy: s.cy, R: s.R })
  }

  function emitInfo(info: SelectionInfo | null) {
    const key = info ? JSON.stringify(info) : ''
    if (key === lastInfoRef.current) return // 去重：同样内容不重复触发 React 渲染
    lastInfoRef.current = key
    onSelectionInfo?.(info)
  }

  function emitSelInfo() {
    const s = sRef.current
    if (!s.selected || s.selected.type !== 'object') {
      emitInfo(null)
      return
    }
    const objId = s.selected.objId
    const obj = s.objects.find((x) => x.id === objId)
    if (!obj) {
      emitInfo(null)
      return
    }
    const Op = O()
    let shape: ImageShape
    let label: string
    if (obj.type === 'point') {
      const p = invert(obj.x, obj.y, s.cx, s.cy, s.R)
      shape = p ? { kind: 'point', p } : { kind: 'none' }
      label = '点'
    } else if (obj.type === 'segment') {
      shape = imageOfSegment(obj.p1, obj.p2, Op, s.R)
      label = '线段'
    } else if (obj.type === 'line') {
      shape = imageOfLine(obj.p1, obj.p2, Op, s.R)
      label = '直线'
    } else {
      shape = imageOfCircle(obj.center, obj.radius, Op, s.R)
      label = '圆'
    }
    const info = describeImage(shape)
    emitInfo({ objLabel: label, title: info.title, lines: info.lines, special: info.special })
  }

  function deleteSelected() {
    const s = sRef.current
    if (s.selected?.type === 'object') {
      const objId = s.selected.objId
      s.objects = s.objects.filter((o) => o.id !== objId)
    }
    s.selected = null
    s.constructing = null
    onSelectionChange?.(false)
    emitInfo(null)
    scheduleDraw()
  }

  function clearAll() {
    const s = sRef.current
    s.objects = []
    s.selected = null
    s.constructing = null
    onSelectionChange?.(false)
    emitInfo(null)
    scheduleDraw()
  }

  function fit() {
    const s = sRef.current
    s.view = computeFitView(s.cx, s.cy, s.R, W(), H())
    scheduleDraw()
  }

  /* ── 指针事件 ── */
  const pointers = useRef<Map<number, Pt>>(new Map())
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)

  function onPointerDown(e: PointerEvent) {
    canvasRef.current!.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      pinchRef.current = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), scale: sRef.current.view.scale }
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
    const hit = hitTest(world, evScreen(e))

    if (s.tool === 'select') {
      if (hit) {
        s.selected = hit
        if (hit.type === 'invRadius') s.drag = { type: 'resizeRadius' }
        else if (hit.type === 'invCenter') s.drag = { type: 'moveInvCenter' }
        else if (hit.type === 'object') s.drag = { type: 'moveVertex', objId: hit.objId, sub: hit.sub }
        onSelectionChange?.(hit.type === 'object')
      } else {
        s.selected = null
        s.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, scx: s.view.cx, scy: s.view.cy }
        onSelectionChange?.(false)
      }
      scheduleDraw()
      return
    }

    if (s.tool === 'point') {
      const id = s.nextId++
      s.objects.push({ type: 'point', id, x: world.x, y: world.y })
      s.selected = { type: 'object', objId: id }
      onSelectionChange?.(true)
      scheduleDraw()
      return
    }

    if (s.tool === 'segment' || s.tool === 'line') {
      if (!s.constructing || !('p1' in s.constructing)) {
        s.constructing = { p1: { x: world.x, y: world.y }, tool: s.tool }
      } else {
        const id = s.nextId++
        s.objects.push({
          type: s.constructing.tool,
          id,
          p1: { ...s.constructing.p1 },
          p2: { x: world.x, y: world.y },
        })
        s.selected = { type: 'object', objId: id }
        s.constructing = null
        onSelectionChange?.(true)
      }
      scheduleDraw()
      return
    }

    if (s.tool === 'circle') {
      if (!s.constructing || !('center' in s.constructing)) {
        s.constructing = { center: { x: world.x, y: world.y } }
      } else {
        const id = s.nextId++
        const r = Math.hypot(world.x - s.constructing.center.x, world.y - s.constructing.center.y)
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
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinchRef.current) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      let scale = (pinchRef.current.scale * dist) / (pinchRef.current.dist || 1)
      scale = Math.max(5, Math.min(300, scale))
      sRef.current.view.scale = scale
      scheduleDraw()
      return
    }
    const s = sRef.current
    const world = evWorld(e)
    if (s.drag) {
      if (s.drag.type === 'pan') {
        s.view.cx = s.drag.scx - (e.clientX - s.drag.sx) / s.view.scale
        s.view.cy = s.drag.scy + (e.clientY - s.drag.sy) / s.view.scale
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
        if (obj) {
          if (obj.type === 'point') {
            obj.x = world.x
            obj.y = world.y
          } else if ((obj.type === 'segment' || obj.type === 'line') && drag.sub === 'p1') {
            obj.p1 = { x: world.x, y: world.y }
          } else if ((obj.type === 'segment' || obj.type === 'line') && drag.sub === 'p2') {
            obj.p2 = { x: world.x, y: world.y }
          } else if (obj.type === 'circle' && drag.sub === 'center') {
            obj.center = { x: world.x, y: world.y }
          }
        }
      }
      scheduleDraw()
      return
    }
    const hit = hitTest(world, evScreen(e))
    canvasRef.current!.style.cursor = hit ? (s.tool === 'select' ? 'grab' : 'pointer') : s.tool === 'select' ? '' : 'crosshair'
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
    s.view.scale = Math.max(5, Math.min(300, s.view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
    scheduleDraw()
  }

  function onKeyDown(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
    const map: Record<string, Tool> = { v: 'select', p: 'point', s: 'segment', l: 'line', c: 'circle', i: 'invCenter' }
    const k = e.key.toLowerCase()
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
    else if (e.key === 'Escape') {
      sRef.current.selected = null
      sRef.current.constructing = null
      onSelectionChange?.(false)
      emitInfo(null)
      onToolChange('select')
      scheduleDraw()
    } else if (k === 'f') fit()
    else if (map[k]) onToolChange(map[k])
  }

  function resize() {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    // 用内容盒尺寸（去掉父容器 padding），否则画布会比可用区域大、溢出被裁剪。
    let W0 = 800
    let H0 = 500
    if (parent) {
      const cs = getComputedStyle(parent)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      W0 = Math.max(1, Math.round(parent.clientWidth - padX))
      H0 = Math.max(1, Math.round(parent.clientHeight - padY))
    }
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

  useImperativeHandle(
    handleRef,
    (): InversionHandle => ({
      fit: () => fit(),
      deleteSelected: () => deleteSelected(),
      clearAll: () => clearAll(),
      setCircle: (cx, cy, R) => {
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    ctxRef.current = canvas.getContext('2d')
    resize()
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

  return <canvas ref={canvasRef} className="block h-full w-full touch-none rounded-xl" style={{ touchAction: 'none' }} />
}
