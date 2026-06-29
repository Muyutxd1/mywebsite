import { useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { pieceSrc } from './pieces'
import type { BoardPiece, Color, LegalTarget, PieceSymbol, PromotionPiece, Square } from './types'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const
const DRAG_THRESHOLD = 6 // px

const PIECE_NAME: Record<PieceSymbol, string> = { p: '兵', n: '马', b: '象', r: '车', q: '后', k: '王' }
const COLOR_NAME: Record<Color, string> = { w: '白', b: '黑' }

const clampIdx = (n: number) => Math.max(0, Math.min(7, n))

interface Cell {
  square: Square
  piece: BoardPiece | null
  fileIndex: number
  rankIndex: number
  isLight: boolean
  displayCol: number
  displayRow: number
}

function squareToDisplay(fileIndex: number, rankIndex: number, orientation: Color) {
  return orientation === 'w'
    ? { displayCol: fileIndex, displayRow: 7 - rankIndex }
    : { displayCol: 7 - fileIndex, displayRow: rankIndex }
}

function displayToSquare(displayCol: number, displayRow: number, orientation: Color): Square {
  const fileIndex = orientation === 'w' ? displayCol : 7 - displayCol
  const rankIndex = orientation === 'w' ? 7 - displayRow : displayRow
  return `${FILES[fileIndex]}${RANKS[rankIndex]}` as Square
}

function buildCells(board: (BoardPiece | null)[][], orientation: Color): Cell[] {
  const cells: Cell[] = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const fileIndex = c
      const rankIndex = 7 - r
      const square = `${FILES[fileIndex]}${RANKS[rankIndex]}` as Square
      const { displayCol, displayRow } = squareToDisplay(fileIndex, rankIndex, orientation)
      cells.push({
        square,
        piece: board[r][c],
        fileIndex,
        rankIndex,
        isLight: (fileIndex + rankIndex) % 2 === 1,
        displayCol,
        displayRow,
      })
    }
  }
  return cells
}

function cellLabel(cell: Cell): string {
  return cell.piece
    ? `${cell.square} ${COLOR_NAME[cell.piece.color]}${PIECE_NAME[cell.piece.type]}`
    : `${cell.square} 空格`
}

interface DragState {
  from: Square
  piece: BoardPiece
  x: number
  y: number
  size: number
}

interface BoardProps {
  board: (BoardPiece | null)[][]
  orientation: Color
  sideToMove: Color
  interactive: boolean
  selected: Square | null
  legalTargets: LegalTarget[]
  lastMove: { from: Square; to: Square } | null
  checkSquare: Square | null
  hint: { from: Square; to: Square } | null
  pendingPromotion: { from: Square; to: Square } | null
  onSquareClick: (sq: Square) => void
  onDrop: (from: Square, to: Square) => void
  onPromote: (p: PromotionPiece) => void
  onCancelPromotion: () => void
}

export function Board({
  board,
  orientation,
  sideToMove,
  interactive,
  selected,
  legalTargets,
  lastMove,
  checkSquare,
  hint,
  pendingPromotion,
  onSquareClick,
  onDrop,
  onPromote,
  onCancelPromotion,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [focusSquare, setFocusSquare] = useState<Square | null>(null)
  const pointerRef = useRef<{
    id: number
    from: Square
    piece: BoardPiece | null
    startX: number
    startY: number
    dragging: boolean
    wasSelected: boolean
  } | null>(null)

  const cells = buildCells(board, orientation)
  const targetMap = new Map(legalTargets.map((t) => [t.square, t.capture]))

  const pointToSquare = (clientX: number, clientY: number): Square | null => {
    const el = boardRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const size = rect.width / 8
    const dc = Math.floor((clientX - rect.left) / size)
    const dr = Math.floor((clientY - rect.top) / size)
    if (dc < 0 || dc > 7 || dr < 0 || dr > 7) return null
    return displayToSquare(dc, dr, orientation)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (pendingPromotion) return
    const square = pointToSquare(e.clientX, e.clientY)
    if (!square) return
    // 让键盘光标跟随指针交互（己方子点击会 preventDefault 抑制 DOM 聚焦，故在此显式同步）。
    setFocusSquare(square)
    const piece = cells.find((c) => c.square === square)?.piece ?? null
    const ownPiece = piece && piece.color === sideToMove
    pointerRef.current = {
      id: e.pointerId,
      from: square,
      piece,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      wasSelected: selected === square,
    }
    // 落在己方子上：选中它（便于拖拽时显示合法目标）。
    if (ownPiece && interactive) {
      if (selected !== square) onSquareClick(square)
      boardRef.current?.setPointerCapture(e.pointerId)
      e.preventDefault()
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointerRef.current
    if (!p || p.id !== e.pointerId) return
    if (!(p.piece && p.piece.color === sideToMove && interactive)) return
    if (!p.dragging) {
      const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY)
      if (dist < DRAG_THRESHOLD) return
      p.dragging = true
    }
    const rect = boardRef.current!.getBoundingClientRect()
    setDrag({ from: p.from, piece: p.piece, x: e.clientX - rect.left, y: e.clientY - rect.top, size: rect.width / 8 })
  }

  const endPointer = (e: React.PointerEvent) => {
    const p = pointerRef.current
    if (!p || p.id !== e.pointerId) return
    pointerRef.current = null
    boardRef.current?.releasePointerCapture?.(e.pointerId)

    if (p.dragging) {
      const target = pointToSquare(e.clientX, e.clientY)
      if (target && target !== p.from) onDrop(p.from, target)
      setDrag(null)
      return
    }
    // 点按（无拖拽）。
    const ownPiece = p.piece && p.piece.color === sideToMove
    if (ownPiece && interactive) {
      // 再次点按已选中的己方子 → 取消选择（按下时未重复触发，这里补发以走 toggle 逻辑）。
      if (p.wasSelected) onSquareClick(p.from)
      // 否则按下时已选中，保持选中。
    } else {
      onSquareClick(p.from)
    }
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    if (pointerRef.current?.id === e.pointerId) {
      pointerRef.current = null
      setDrag(null)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (pendingPromotion) return
    const cur = focusSquare ?? displayToSquare(0, 0, orientation)
    const f = FILES.indexOf(cur[0] as (typeof FILES)[number])
    const r = RANKS.indexOf(cur[1] as (typeof RANKS)[number])
    let { displayCol, displayRow } = squareToDisplay(f, r, orientation)
    switch (e.key) {
      case 'ArrowRight':
        displayCol++
        break
      case 'ArrowLeft':
        displayCol--
        break
      case 'ArrowUp':
        displayRow--
        break
      case 'ArrowDown':
        displayRow++
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onSquareClick(cur)
        return
      case 'Escape':
        if (selected) onSquareClick(selected)
        return
      default:
        return
    }
    e.preventDefault()
    const next = displayToSquare(clampIdx(displayCol), clampIdx(displayRow), orientation)
    setFocusSquare(next)
    boardRef.current?.querySelector<HTMLElement>(`[data-square="${next}"]`)?.focus()
  }

  return (
    <div className="relative w-full max-w-[560px] select-none">
      <div
        ref={boardRef}
        role="grid"
        aria-label="国际象棋棋盘"
        className="relative grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-xl shadow-[var(--shadow-lift)] ring-1 ring-black/30"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
      >
        {cells.map((cell) => {
          const isSelected = selected === cell.square
          const isTarget = targetMap.has(cell.square)
          const isCapture = targetMap.get(cell.square) === true
          const isLast = lastMove && (lastMove.from === cell.square || lastMove.to === cell.square)
          const isCheck = checkSquare === cell.square
          const isHint = hint && (hint.from === cell.square || hint.to === cell.square)
          const isDragOrigin = drag?.from === cell.square
          const isFocusTarget = focusSquare
            ? focusSquare === cell.square
            : cell.displayCol === 0 && cell.displayRow === 0

          return (
            <div
              key={cell.square}
              role="gridcell"
              aria-label={cellLabel(cell)}
              aria-selected={isSelected}
              data-square={cell.square}
              tabIndex={isFocusTarget ? 0 : -1}
              onFocus={() => setFocusSquare(cell.square)}
              className="relative outline-offset-[-3px]"
              style={{
                gridColumn: cell.displayCol + 1,
                gridRow: cell.displayRow + 1,
                backgroundColor: cell.isLight ? '#e7eaf4' : '#5a6498',
              }}
            >
              {/* last-move tint */}
              {isLast && <div className="absolute inset-0 bg-gold/35" />}
              {/* hint tint */}
              {isHint && <div className="absolute inset-0 bg-cyan/35" />}
              {/* check glow */}
              {isCheck && (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(closest-side, rgba(240,97,109,0.9), rgba(240,97,109,0.35) 60%, transparent 75%)',
                  }}
                />
              )}
              {/* selected ring */}
              {isSelected && (
                <div className="pointer-events-none absolute inset-0 ring-[3px] ring-inset ring-accent" />
              )}

              {/* coordinate labels */}
              {cell.displayCol === 0 && (
                <span
                  className={cn(
                    'pointer-events-none absolute left-0.5 top-0 text-[10px] font-semibold sm:text-xs',
                    cell.isLight ? 'text-[#5a6498]' : 'text-[#e7eaf4]',
                  )}
                >
                  {RANKS[cell.rankIndex]}
                </span>
              )}
              {cell.displayRow === 7 && (
                <span
                  className={cn(
                    'pointer-events-none absolute bottom-0 right-0.5 text-[10px] font-semibold sm:text-xs',
                    cell.isLight ? 'text-[#5a6498]' : 'text-[#e7eaf4]',
                  )}
                >
                  {FILES[cell.fileIndex]}
                </span>
              )}

              {/* legal-move marker */}
              {isTarget &&
                (isCapture ? (
                  <div
                    className="pointer-events-none absolute inset-[6%] rounded-full border-[5px]"
                    style={{ borderColor: cell.isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.28)' }}
                  />
                ) : (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className="h-[30%] w-[30%] rounded-full"
                      style={{ backgroundColor: cell.isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.26)' }}
                    />
                  </div>
                ))}

              {/* piece */}
              {cell.piece && (
                <img
                  src={pieceSrc(cell.piece.color, cell.piece.type)}
                  alt=""
                  draggable={false}
                  className={cn(
                    'pointer-events-none absolute inset-0 h-full w-full p-[6%] transition-opacity',
                    isDragOrigin && 'opacity-0',
                  )}
                  style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.35))' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* floating drag piece */}
      {drag && (
        <img
          src={pieceSrc(drag.piece.color, drag.piece.type)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute z-30"
          style={{
            width: drag.size,
            height: drag.size,
            left: drag.x,
            top: drag.y,
            transform: 'translate(-50%, -50%) scale(1.06)',
            filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.45))',
          }}
        />
      )}

      {/* promotion picker */}
      {pendingPromotion && (
        <PromotionOverlay
          to={pendingPromotion.to}
          orientation={orientation}
          color={sideToMove}
          onPick={onPromote}
          onCancel={onCancelPromotion}
        />
      )}
    </div>
  )
}

const PROMO_ORDER: PromotionPiece[] = ['q', 'r', 'b', 'n']

function PromotionOverlay({
  to,
  orientation,
  color,
  onPick,
  onCancel,
}: {
  to: Square
  orientation: Color
  color: Color
  onPick: (p: PromotionPiece) => void
  onCancel: () => void
}) {
  const fileIndex = FILES.indexOf(to[0] as (typeof FILES)[number])
  const rankIndex = RANKS.indexOf(to[1] as (typeof RANKS)[number])
  const { displayCol, displayRow } = squareToDisplay(fileIndex, rankIndex, orientation)
  const downward = displayRow === 0 // 升变格在顶端则向下展开，否则向上

  return (
    <div className="absolute inset-0 z-40 bg-black/45" onClick={onCancel}>
      <div
        className="absolute flex flex-col"
        style={{ left: `${displayCol * 12.5}%`, top: downward ? 0 : 'auto', bottom: downward ? 'auto' : 0, width: '12.5%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {(downward ? PROMO_ORDER : [...PROMO_ORDER].reverse()).map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            aria-label={`升变为${COLOR_NAME[color]}${PIECE_NAME[p]}`}
            className="flex aspect-square items-center justify-center bg-surface-2 transition-colors hover:bg-accent/30"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
          >
            <img src={pieceSrc(color, p)} alt="" draggable={false} className="h-[86%] w-[86%]" />
          </button>
        ))}
      </div>
    </div>
  )
}
