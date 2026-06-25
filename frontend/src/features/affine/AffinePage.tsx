import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui'
import {
  defaultShape,
  makeRotate,
  matIdentity,
  type Mat,
  type Pt,
} from './lib/affineMath'
import { AffineCanvas, type AffineCanvasHandle } from './components/AffineCanvas'
import { AffineSidebar } from './components/AffineSidebar'
import type { AffineState } from './types'

function initialState(): AffineState {
  return {
    transformMatrix: makeRotate(45), // legacy default: 45° rotation
    projectiveMode: false,
    projectiveG: 0,
    projectiveH: 0,
    inversionMode: false,
    inversionCX: 0,
    inversionCY: 0,
    inversionR: 2,
    viewLeft: { cx: 0, cy: 0, scale: 1 },
    viewRight: { cx: 0, cy: 0, scale: 1 },
  }
}

export default function AffinePage() {
  const canvasApi = useRef<AffineCanvasHandle | null>(null)

  // Live refs the canvas reads/mutates on hot paths.
  const stateRef = useRef<AffineState>(initialState())
  const shapeRef = useRef<Pt[]>(defaultShape.map((v) => ({ ...v })))

  // Force a React re-render (UI mirrors the refs; canvas owns the hot path).
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const repaint = useCallback(() => canvasApi.current?.repaint(), [])
  const fitAndPaint = useCallback(() => canvasApi.current?.fitView(), [])

  // Apply a mutation to the live state, then refit + repaint + refresh UI.
  const update = useCallback(
    (fn: (s: AffineState) => void, refit = true) => {
      fn(stateRef.current)
      if (refit) fitAndPaint()
      else repaint()
      bump()
    },
    [fitAndPaint, repaint],
  )

  // ── Sidebar handlers ──
  const onPreset = useCallback(
    (mat: Mat) => update((s) => { s.transformMatrix = [...mat] }),
    [update],
  )

  const onMatrixCell = useCallback(
    (idx: number, value: number) =>
      update((s) => {
        const m = [...s.transformMatrix]
        m[idx] = value
        s.transformMatrix = m
      }),
    [update],
  )

  const onToggleProjective = useCallback(
    (on: boolean) => update((s) => { s.projectiveMode = on }),
    [update],
  )
  const onProjective = useCallback(
    (which: 'g' | 'h', value: number) =>
      update((s) => {
        if (which === 'g') s.projectiveG = value
        else s.projectiveH = value
      }),
    [update],
  )

  const onToggleInversion = useCallback(
    (on: boolean) => update((s) => { s.inversionMode = on }),
    [update],
  )
  const onInversion = useCallback(
    (which: 'cx' | 'cy' | 'r', value: number) =>
      update((s) => {
        if (which === 'cx') s.inversionCX = value
        else if (which === 'cy') s.inversionCY = value
        else s.inversionR = value
      }),
    [update],
  )

  const onResetView = useCallback(() => fitAndPaint(), [fitAndPaint])

  const onResetAll = useCallback(() => {
    stateRef.current = initialReset(stateRef.current)
    shapeRef.current = defaultShape.map((v) => ({ ...v }))
    fitAndPaint()
    bump()
  }, [fitAndPaint])

  // Canvas → React: vertex drag mutated shapeRef (just refresh UI, canvas already repainted).
  const onShapeChange = useCallback(() => bump(), [])
  const onViewChange = useCallback(() => {}, [])

  // Initial fit once mounted.
  useEffect(() => {
    fitAndPaint()
  }, [fitAndPaint])

  const s = stateRef.current

  const sidebar = (
    <AffineSidebar
      transformMatrix={s.transformMatrix}
      projectiveMode={s.projectiveMode}
      projectiveG={s.projectiveG}
      projectiveH={s.projectiveH}
      inversionMode={s.inversionMode}
      inversionCX={s.inversionCX}
      inversionCY={s.inversionCY}
      inversionR={s.inversionR}
      onPreset={onPreset}
      onMatrixCell={onMatrixCell}
      onToggleProjective={onToggleProjective}
      onProjective={onProjective}
      onToggleInversion={onToggleInversion}
      onInversion={onInversion}
      onResetView={onResetView}
      onResetAll={onResetAll}
    />
  )

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col px-4 py-6 sm:px-6">
      {/* Page header */}
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">
            Visualizer · 几何
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">仿射变换</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            拖动顶点、调矩阵、加射影与反演 —— 实时观察平面如何被一个 3×3 矩阵重塑。
          </p>
        </div>
        {/* Mobile drawer trigger */}
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 lg:hidden"
          onClick={() => setDrawerOpen(true)}
        >
          参数面板
        </Button>
      </header>

      {/* Body: sidebar + canvas */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Desktop sidebar (260px) */}
        <aside className="hidden w-[260px] shrink-0 overflow-y-auto pr-1 lg:block">{sidebar}</aside>

        {/* Canvas fills the rest */}
        <main className="min-h-0 min-w-0 flex-1">
          <AffineCanvas
            ref={canvasApi}
            stateRef={stateRef}
            shapeRef={shapeRef}
            onShapeChange={onShapeChange}
            onViewChange={onViewChange}
          />
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              'absolute inset-y-0 left-0 w-[85vw] max-w-[320px] overflow-y-auto',
              'border-r border-border bg-surface p-5 shadow-[var(--shadow-lift)]',
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">参数面板</h2>
              <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>
                关闭
              </Button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  )
}

/** Reset everything but keep the viewLeft/viewRight objects' identity not required. */
function initialReset(_prev: AffineState): AffineState {
  return {
    transformMatrix: matIdentity(),
    projectiveMode: false,
    projectiveG: 0,
    projectiveH: 0,
    inversionMode: false,
    inversionCX: 0,
    inversionCY: 0,
    inversionR: 2,
    viewLeft: { cx: 0, cy: 0, scale: 1 },
    viewRight: { cx: 0, cy: 0, scale: 1 },
  }
}
