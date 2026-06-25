import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import {
  applyInversion,
  applyTransform,
  autoFitView,
  buildFullMatrix,
  canvasToWorld,
  getTransformedVertices,
  matInv,
  type Pt,
} from '../lib/affineMath'
import { computeLayout, renderAll, type Layout } from '../lib/affineRender'
import type { AffineState, DragState, HoverState, PanState, Side } from '../types'

const STACK_BREAKPOINT = 800

export interface AffineCanvasHandle {
  /** Re-read state (held by parent in a ref) and repaint. */
  repaint: () => void
  /** Re-fit both viewports to current shapes, then repaint. */
  fitView: () => void
}

interface Props {
  /** Live state ref owned by the page; mutated in place for hot paths. */
  stateRef: React.MutableRefObject<AffineState>
  /** Live shape vertices ref owned by the page. */
  shapeRef: React.MutableRefObject<Pt[]>
  /** Called after a vertex drag mutates the shape, so React UI can refresh. */
  onShapeChange: () => void
  /** Called after a wheel/pan mutates a view, so React UI can refresh if needed. */
  onViewChange: () => void
}

export const AffineCanvas = forwardRef<AffineCanvasHandle, Props>(function AffineCanvas(
  { stateRef, shapeRef, onShapeChange, onViewChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Imperative interaction state (refs → no re-render churn, no stale closures).
  const layoutRef = useRef<Layout>({
    leftRect: { x: 0, y: 0, w: 1, h: 1 },
    rightRect: { x: 0, y: 0, w: 1, h: 1 },
    stacked: false,
  })
  const cssSizeRef = useRef({ w: 1, h: 1 })
  const dprRef = useRef(1)
  const draggingRef = useRef<DragState | null>(null)
  const panningRef = useRef<PanState | null>(null)
  const hoveredRef = useRef<HoverState | null>(null)
  const rafRef = useRef(0)

  // ── Repaint via requestAnimationFrame (coalesces bursty pointer moves) ──
  function scheduleRender() {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      paint()
    })
  }

  function paint() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = cssSizeRef.current
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
    renderAll(ctx, w, h, layoutRef.current, stateRef.current, shapeRef.current, hoveredRef.current)
  }

  function fit() {
    const { viewLeft, viewRight } = autoFitView(
      shapeRef.current,
      getTransformedVertices(shapeRef.current, stateRef.current),
      layoutRef.current.leftRect,
    )
    stateRef.current.viewLeft = viewLeft
    stateRef.current.viewRight = viewRight
  }

  useImperativeHandle(ref, () => ({
    repaint: () => scheduleRender(),
    fitView: () => {
      fit()
      scheduleRender()
    },
  }))

  // ── Resize / DPR handling ──
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    function resize() {
      const rect = wrap!.getBoundingClientRect()
      let w = rect.width
      let h = rect.height
      if (w <= 0) w = 800
      if (h <= 0) h = 500
      const dpr = window.devicePixelRatio || 1
      dprRef.current = dpr
      cssSizeRef.current = { w, h }
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      canvas!.style.width = w + 'px'
      canvas!.style.height = h + 'px'
      layoutRef.current = computeLayout(w, h, w < STACK_BREAKPOINT)
      fit()
      paint()
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    window.addEventListener('resize', resize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', resize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Hit-testing helpers (CSS-pixel coords) ──
  function eventCanvasPos(clientX: number, clientY: number) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    // Map to CSS pixels of the canvas drawing area (style size == css size).
    const cx = ((clientX - rect.left) / rect.width) * cssSizeRef.current.w
    const cy = ((clientY - rect.top) / rect.height) * cssSizeRef.current.h
    return { cx, cy }
  }

  function sideForPoint(cx: number, cy: number): Side {
    const lo = layoutRef.current
    if (lo.stacked) return cy < lo.leftRect.h ? 'left' : 'right'
    return cx < lo.leftRect.w ? 'left' : 'right'
  }

  function getTarget(clientX: number, clientY: number) {
    const { cx, cy } = eventCanvasPos(clientX, clientY)
    const side = sideForPoint(cx, cy)
    const lo = layoutRef.current
    const rect = side === 'left' ? lo.leftRect : lo.rightRect
    const view = side === 'left' ? stateRef.current.viewLeft : stateRef.current.viewRight
    const world = canvasToWorld(cx, cy, view, rect)
    const vertices = side === 'left' ? shapeRef.current : getTransformedVertices(shapeRef.current, stateRef.current)
    const threshold = 12 / view.scale
    let vertexIdx = -1
    for (let i = 0; i < vertices.length; i++) {
      const dx = world.x - vertices[i].x
      const dy = world.y - vertices[i].y
      if (Number.isFinite(dx) && Number.isFinite(dy) && Math.sqrt(dx * dx + dy * dy) < threshold) {
        vertexIdx = i
        break
      }
    }
    return { side, world, vertexIdx, cx, cy }
  }

  // ── Pointer interaction (mouse + touch via Pointer Events) ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function setCursor(c: string) {
      if (canvas) canvas.style.cursor = c
    }

    function onPointerDown(e: PointerEvent) {
      // Right button OR two-finger style → pan the hovered viewport.
      if (e.button === 2) {
        const { cx, cy } = eventCanvasPos(e.clientX, e.clientY)
        const side = sideForPoint(cx, cy)
        const view = side === 'left' ? stateRef.current.viewLeft : stateRef.current.viewRight
        panningRef.current = {
          side,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startCx: view.cx,
          startCy: view.cy,
        }
        setCursor('grabbing')
        canvas!.setPointerCapture(e.pointerId)
        return
      }
      if (e.button !== 0) return

      const t = getTarget(e.clientX, e.clientY)
      if (t.vertexIdx >= 0) {
        draggingRef.current = { side: t.side, idx: t.vertexIdx }
        setCursor('grabbing')
        canvas!.setPointerCapture(e.pointerId)
        e.preventDefault()
      } else if (e.pointerType === 'touch') {
        // On touch, a drag on empty space pans the viewport (no right-click).
        const side = t.side
        const view = side === 'left' ? stateRef.current.viewLeft : stateRef.current.viewRight
        panningRef.current = {
          side,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startCx: view.cx,
          startCy: view.cy,
        }
        canvas!.setPointerCapture(e.pointerId)
      }
    }

    function onPointerMove(e: PointerEvent) {
      const pan = panningRef.current
      if (pan) {
        const rect = canvas!.getBoundingClientRect()
        const dx = ((e.clientX - pan.startClientX) / rect.width) * cssSizeRef.current.w
        const dy = ((e.clientY - pan.startClientY) / rect.height) * cssSizeRef.current.h
        const view = pan.side === 'left' ? stateRef.current.viewLeft : stateRef.current.viewRight
        view.cx = pan.startCx - dx / view.scale
        view.cy = pan.startCy + dy / view.scale
        scheduleRender()
        return
      }

      const drag = draggingRef.current
      if (drag) {
        const t = getTarget(e.clientX, e.clientY)
        if (drag.side === 'left') {
          shapeRef.current[drag.idx] = { x: t.world.x, y: t.world.y }
          onShapeChange()
        } else {
          // Right-side drag: map back through self-inverse inversion + matInv.
          let wx = t.world.x
          let wy = t.world.y
          const st = stateRef.current
          if (st.inversionMode) {
            const invPt = applyInversion(wx, wy, st.inversionCX, st.inversionCY, st.inversionR)
            wx = invPt.x
            wy = invPt.y
          }
          const M = buildFullMatrix(st)
          const inv = matInv(M)
          if (inv && Number.isFinite(wx) && Number.isFinite(wy)) {
            const orig = applyTransform(inv, wx, wy)
            if (Number.isFinite(orig.x) && Number.isFinite(orig.y)) {
              shapeRef.current[drag.idx] = { x: orig.x, y: orig.y }
              onShapeChange()
            }
          }
        }
        scheduleRender()
        return
      }

      // Hover detection
      const t = getTarget(e.clientX, e.clientY)
      const prev = hoveredRef.current
      if (t.vertexIdx >= 0) {
        hoveredRef.current = { side: t.side, idx: t.vertexIdx }
        setCursor('grab')
      } else {
        hoveredRef.current = null
        setCursor('')
      }
      // Only repaint if hover actually changed.
      const next = hoveredRef.current
      if ((prev?.idx !== next?.idx || prev?.side !== next?.side)) scheduleRender()
    }

    function endInteraction() {
      draggingRef.current = null
      panningRef.current = null
      if (canvas) canvas.style.cursor = hoveredRef.current ? 'grab' : ''
      onViewChange()
      scheduleRender()
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const { cx, cy } = eventCanvasPos(e.clientX, e.clientY)
      const side = sideForPoint(cx, cy)
      const view = side === 'left' ? stateRef.current.viewLeft : stateRef.current.viewRight
      const zoom = e.deltaY < 0 ? 1.15 : 1 / 1.15
      view.scale *= zoom
      view.scale = Math.max(5, Math.min(200, view.scale))
      onViewChange()
      scheduleRender()
    }

    function onContextMenu(e: Event) {
      e.preventDefault()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endInteraction)
    canvas.addEventListener('pointercancel', endInteraction)
    canvas.addEventListener('pointerleave', endInteraction)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContextMenu)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endInteraction)
      canvas.removeEventListener('pointercancel', endInteraction)
      canvas.removeEventListener('pointerleave', endInteraction)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden rounded-xl border border-border-soft bg-bg-soft"
    >
      <canvas ref={canvasRef} className="block h-full w-full touch-none select-none" />
    </div>
  )
})
