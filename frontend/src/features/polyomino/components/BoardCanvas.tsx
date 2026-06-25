import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { cellFromPoint, computeCellSize, drawBoard } from '../lib/drawBoard'
import type { ActiveSelection, BoardState, HoverCell, Piece } from '../types'

/**
 * Imperative board canvas. Hover/ghost redraws run through a requestAnimationFrame
 * loop reading LIVE state via refs — per-pointer-move never touches React state,
 * avoiding re-render churn and stale-closure bugs.
 */
export function BoardCanvas({
  board,
  library,
  active,
  onPlace,
  onDeselect,
}: {
  board: BoardState
  library: Piece[]
  active: ActiveSelection | null
  /** Attempt to place the active piece at a cell. */
  onPlace: (r: number, c: number) => void
  /** Right-click / context menu deselect. */
  onDeselect: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Live refs so the rAF draw + event handlers always read current values.
  const boardRef = useRef(board)
  const libraryRef = useRef(library)
  const activeRef = useRef(active)
  const hoverRef = useRef<HoverCell | null>(null)
  const cellSizeRef = useRef(30)
  const rafRef = useRef<number | null>(null)

  boardRef.current = board
  libraryRef.current = library
  activeRef.current = active

  const requestDraw = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const canvas = canvasRef.current
      if (!canvas) return
      drawBoard({
        canvas,
        board: boardRef.current,
        library: libraryRef.current,
        active: activeRef.current,
        hover: hoverRef.current,
        cellSize: cellSizeRef.current,
      })
    })
  }, [])

  const recalc = useCallback(() => {
    const wrap = wrapRef.current
    const b = boardRef.current
    const isMobile = window.innerWidth <= 800
    const maxW = isMobile
      ? window.innerWidth - 32
      : Math.max(240, (wrap?.clientWidth ?? window.innerWidth - 360) - 4)
    const maxH = isMobile
      ? window.innerHeight - 200
      : Math.min(window.innerHeight - 200, 680)
    cellSizeRef.current = computeCellSize(b.rows, b.cols, maxW, maxH)
  }, [])

  // Redraw whenever board/library/active change (React-driven updates).
  useLayoutEffect(() => {
    recalc()
    requestDraw()
  }, [board, library, active, recalc, requestDraw])

  // Resize handling.
  useEffect(() => {
    const onResize = () => {
      recalc()
      requestDraw()
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [recalc, requestDraw])

  // Pointer move -> update hover ref + redraw (no React state).
  const updateHover = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      hoverRef.current = cellFromPoint(canvas, clientX, clientY, cellSizeRef.current, boardRef.current)
      requestDraw()
    },
    [requestDraw],
  )

  function handlePlace(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const cell = cellFromPoint(canvas, clientX, clientY, cellSizeRef.current, boardRef.current)
    if (!cell || !activeRef.current) return
    onPlace(cell.r, cell.c)
  }

  return (
    <div ref={wrapRef} className="max-w-full overflow-auto rounded-xl border border-border-soft bg-bg p-2">
      <canvas
        ref={canvasRef}
        className="block touch-none select-none"
        style={{ cursor: active ? 'pointer' : 'crosshair' }}
        onMouseMove={(e) => updateHover(e.clientX, e.clientY)}
        onMouseLeave={() => {
          hoverRef.current = null
          requestDraw()
        }}
        onClick={(e) => handlePlace(e.clientX, e.clientY)}
        onContextMenu={(e) => {
          e.preventDefault()
          if (activeRef.current) onDeselect()
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            const t = e.touches[0]
            updateHover(t.clientX, t.clientY)
            if (activeRef.current) {
              e.preventDefault()
              handlePlace(t.clientX, t.clientY)
            }
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 1) {
            e.preventDefault()
            const t = e.touches[0]
            updateHover(t.clientX, t.clientY)
          }
        }}
        onTouchEnd={() => {
          hoverRef.current = null
          requestDraw()
        }}
      />
    </div>
  )
}
