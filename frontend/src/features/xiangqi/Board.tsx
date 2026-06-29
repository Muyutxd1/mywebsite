import { useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { LegalTarget } from './useXiangqiGame'
import type { Color, Coord, Piece, PieceType } from './types'

const ROWS = 10
const COLS = 9
const DRAG_THRESHOLD = 6
// viewBox 单位：外边距 1，列距/行距 1 → 宽 10、高 11。交点 (r,c) 落在 (1+c, 1+r)。
const VB_W = 10
const VB_H = 11
const DISC = 0.88 // 棋子直径（viewBox 单位）

const CHAR: Record<Color, Record<PieceType, string>> = {
  r: { k: '帅', a: '仕', e: '相', h: '马', r: '车', c: '炮', p: '兵' },
  b: { k: '将', a: '士', e: '象', h: '马', r: '车', c: '炮', p: '卒' },
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function toDisplay(r: number, c: number, orientation: Color) {
  return orientation === 'r' ? { dr: r, dc: c } : { dr: ROWS - 1 - r, dc: COLS - 1 - c }
}
function fromDisplay(dr: number, dc: number, orientation: Color): Coord {
  return orientation === 'r' ? [dr, dc] : [ROWS - 1 - dr, COLS - 1 - dc]
}

// 百分比定位（基于交点的 display 坐标）。
const leftPct = (dc: number) => ((1 + dc) / VB_W) * 100
const topPct = (dr: number) => ((1 + dr) / VB_H) * 100

interface DragState {
  from: Coord
  piece: Piece
  x: number
  y: number
  size: number
}

interface BoardProps {
  board: (Piece | null)[][]
  orientation: Color
  sideToMove: Color
  interactive: boolean
  selected: Coord | null
  legalTargets: LegalTarget[]
  lastMove: { from: Coord; to: Coord } | null
  checkGeneral: Coord | null
  hint: { from: Coord; to: Coord } | null
  onPointClick: (r: number, c: number) => void
  onDrop: (from: Coord, to: Coord) => void
}

export function Board({
  board,
  orientation,
  sideToMove,
  interactive,
  selected,
  legalTargets,
  lastMove,
  checkGeneral,
  hint,
  onPointClick,
  onDrop,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [focus, setFocus] = useState<Coord | null>(null)
  const pointerRef = useRef<{
    id: number
    from: Coord
    piece: Piece | null
    startX: number
    startY: number
    dragging: boolean
    wasSelected: boolean
  } | null>(null)

  const targetMap = new Map(legalTargets.map((t) => [`${t.to[0]},${t.to[1]}`, t.capture]))
  const key = (r: number, c: number) => `${r},${c}`
  const isSel = (r: number, c: number) => !!selected && selected[0] === r && selected[1] === c
  const isLast = (r: number, c: number) =>
    !!lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c))
  const isHint = (r: number, c: number) =>
    !!hint && ((hint.from[0] === r && hint.from[1] === c) || (hint.to[0] === r && hint.to[1] === c))
  const isCheck = (r: number, c: number) => !!checkGeneral && checkGeneral[0] === r && checkGeneral[1] === c

  const pointToCoord = (clientX: number, clientY: number): Coord | null => {
    const el = boardRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const dc = Math.round(((clientX - rect.left) / rect.width) * VB_W - 1)
    const dr = Math.round(((clientY - rect.top) / rect.height) * VB_H - 1)
    if (dc < 0 || dc > COLS - 1 || dr < 0 || dr > ROWS - 1) return null
    return fromDisplay(dr, dc, orientation)
  }

  const discSizePx = () => {
    const rect = boardRef.current?.getBoundingClientRect()
    return rect ? (DISC / VB_W) * rect.width : 0
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const coord = pointToCoord(e.clientX, e.clientY)
    if (!coord) return
    setFocus(coord)
    // 对所有落点捕获指针：即便手指最终在棋盘外抬起，点选/拖拽也能正常结算。
    boardRef.current?.setPointerCapture(e.pointerId)
    const piece = board[coord[0]][coord[1]]
    const ownPiece = piece && piece.color === sideToMove
    pointerRef.current = {
      id: e.pointerId,
      from: coord,
      piece,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      wasSelected: isSel(coord[0], coord[1]),
    }
    if (ownPiece && interactive) {
      if (!isSel(coord[0], coord[1])) onPointClick(coord[0], coord[1])
      e.preventDefault()
      // preventDefault 抑制了原生聚焦，手动移动 DOM 焦点以保持 roving tabindex 同步。
      boardRef.current?.querySelector<HTMLElement>(`[data-pt="${coord[0]},${coord[1]}"]`)?.focus()
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointerRef.current
    if (!p || p.id !== e.pointerId) return
    if (!(p.piece && p.piece.color === sideToMove && interactive)) return
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_THRESHOLD) return
      p.dragging = true
    }
    const rect = boardRef.current!.getBoundingClientRect()
    setDrag({ from: p.from, piece: p.piece, x: e.clientX - rect.left, y: e.clientY - rect.top, size: (DISC / VB_W) * rect.width })
  }

  const endPointer = (e: React.PointerEvent) => {
    const p = pointerRef.current
    if (!p || p.id !== e.pointerId) return
    pointerRef.current = null
    boardRef.current?.releasePointerCapture?.(e.pointerId)
    if (p.dragging) {
      const to = pointToCoord(e.clientX, e.clientY)
      if (to && (to[0] !== p.from[0] || to[1] !== p.from[1])) onDrop(p.from, to)
      setDrag(null)
      return
    }
    const ownPiece = p.piece && p.piece.color === sideToMove
    if (ownPiece && interactive) {
      if (p.wasSelected) onPointClick(p.from[0], p.from[1])
    } else {
      onPointClick(p.from[0], p.from[1])
    }
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    if (pointerRef.current?.id === e.pointerId) {
      pointerRef.current = null
      setDrag(null)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const cur = focus ?? fromDisplay(0, 0, orientation)
    let { dr, dc } = toDisplay(cur[0], cur[1], orientation)
    switch (e.key) {
      case 'ArrowRight': dc++; break
      case 'ArrowLeft': dc--; break
      case 'ArrowUp': dr--; break
      case 'ArrowDown': dr++; break
      case 'Enter':
      case ' ':
        e.preventDefault()
        onPointClick(cur[0], cur[1])
        return
      default:
        return
    }
    e.preventDefault()
    const next = fromDisplay(clamp(dr, 0, ROWS - 1), clamp(dc, 0, COLS - 1), orientation)
    setFocus(next)
    boardRef.current?.querySelector<HTMLElement>(`[data-pt="${next[0]},${next[1]}"]`)?.focus()
  }

  // 渲染所有交点（含棋子 / 标记 / 可达点）。
  const points: { r: number; c: number; dr: number; dc: number; piece: Piece | null }[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { dr, dc } = toDisplay(r, c, orientation)
      points.push({ r, c, dr, dc, piece: board[r][c] })
    }
  }

  return (
    <div className="relative w-full max-w-[480px] select-none">
      <div
        ref={boardRef}
        role="group"
        aria-label="中国象棋棋盘"
        className="relative w-full rounded-xl shadow-[var(--shadow-lift)] ring-1 ring-black/30"
        style={{ aspectRatio: `${VB_W} / ${VB_H}`, background: 'linear-gradient(160deg, #eccf93, #e0b975)', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
      >
        {/* 棋盘线条 / 九宫 / 河界 */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
          <g stroke="#7a5a32" strokeWidth={0.04} strokeLinecap="round" fill="none">
            {Array.from({ length: ROWS }, (_, r) => (
              <line key={`h${r}`} x1={1} y1={1 + r} x2={1 + COLS - 1} y2={1 + r} />
            ))}
            {Array.from({ length: COLS }, (_, c) => {
              const x = 1 + c
              if (c === 0 || c === COLS - 1) return <line key={`v${c}`} x1={x} y1={1} x2={x} y2={1 + ROWS - 1} />
              return (
                <g key={`v${c}`}>
                  <line x1={x} y1={1} x2={x} y2={5} />
                  <line x1={x} y1={6} x2={x} y2={10} />
                </g>
              )
            })}
            {/* 九宫斜线 */}
            <line x1={4} y1={1} x2={6} y2={3} />
            <line x1={6} y1={1} x2={4} y2={3} />
            <line x1={4} y1={8} x2={6} y2={10} />
            <line x1={6} y1={8} x2={4} y2={10} />
          </g>
          <text x={3} y={5.7} fontSize={0.78} fill="#7a5a32" textAnchor="middle" style={{ fontWeight: 700, letterSpacing: 0.1 }}>
            楚河
          </text>
          <text x={7} y={5.7} fontSize={0.78} fill="#7a5a32" textAnchor="middle" style={{ fontWeight: 700, letterSpacing: 0.1 }}>
            漢界
          </text>
        </svg>

        {/* 棋子 / 标记层 */}
        {points.map(({ r, c, dr, dc, piece }) => {
          const target = targetMap.has(key(r, c))
          const capture = targetMap.get(key(r, c)) === true
          const sel = isSel(r, c)
          const last = isLast(r, c)
          const hinted = isHint(r, c)
          const checked = isCheck(r, c)
          const dragging = drag && drag.from[0] === r && drag.from[1] === c
          const isFocusTarget = focus ? focus[0] === r && focus[1] === c : dr === 0 && dc === 0

          return (
            <div
              key={key(r, c)}
              role="button"
              data-pt={key(r, c)}
              tabIndex={isFocusTarget ? 0 : -1}
              aria-label={piece ? `${piece.color === 'r' ? '红' : '黑'}${CHAR[piece.color][piece.type]}` : '空位'}
              onFocus={() => setFocus([r, c])}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${leftPct(dc)}%`, top: `${topPct(dr)}%`, width: `${(DISC / VB_W) * 100}%`, aspectRatio: '1 / 1' }}
            >
              {/* 上一步 / 提示 / 选中 在底层标记四角或描边 */}
              {(last || hinted) && (
                <span
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ boxShadow: `inset 0 0 0 2px ${hinted ? 'rgba(69,214,230,0.9)' : 'rgba(231,180,85,0.95)'}` }}
                />
              )}

              {/* 可达空点：圆点；可吃点（有子）：外环 */}
              {target && !piece && (
                <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ width: '36%', height: '36%', background: 'rgba(33,28,18,0.62)', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.55)' }} />
              )}
              {target && piece && (
                <span className="pointer-events-none absolute rounded-full" style={{ inset: '-12%', boxShadow: 'inset 0 0 0 3px rgba(122,90,50,0.6)' }} />
              )}

              {piece && (
                <div
                  className={cn(
                    'absolute inset-0 flex items-center justify-center rounded-full transition-opacity',
                    dragging && 'opacity-0',
                  )}
                  style={{
                    background: 'radial-gradient(circle at 35% 30%, #fbf2dd, #ecd9b0 70%, #d9bd86)',
                    boxShadow: checked
                      ? '0 0 0 2px #f0616d, 0 0 10px 2px rgba(240,97,109,0.8)'
                      : sel
                        ? '0 0 0 2px #6f5cff, 0 2px 4px rgba(0,0,0,0.4)'
                        : '0 1px 3px rgba(0,0,0,0.45), inset 0 0 0 1.5px rgba(122,90,50,0.55)',
                  }}
                >
                  <span
                    className="font-bold leading-none"
                    style={{
                      color: piece.color === 'r' ? '#c0392b' : '#1f2430',
                      fontSize: 'min(5.2vw, 1.55rem)',
                      textShadow: '0 1px 0 rgba(255,255,255,0.4)',
                    }}
                  >
                    {CHAR[piece.color][piece.type]}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 拖拽中的浮动棋子 */}
      {drag && (
        <div
          className="pointer-events-none absolute z-30 flex items-center justify-center rounded-full"
          style={{
            width: drag.size,
            height: drag.size,
            left: drag.x,
            top: drag.y,
            transform: 'translate(-50%, -50%) scale(1.08)',
            background: 'radial-gradient(circle at 35% 30%, #fbf2dd, #ecd9b0 70%, #d9bd86)',
            boxShadow: '0 6px 10px rgba(0,0,0,0.5), inset 0 0 0 1.5px rgba(122,90,50,0.55)',
          }}
        >
          <span className="font-bold leading-none" style={{ color: drag.piece.color === 'r' ? '#c0392b' : '#1f2430', fontSize: 'min(5.5vw, 1.6rem)' }}>
            {CHAR[drag.piece.color][drag.piece.type]}
          </span>
        </div>
      )}
    </div>
  )
}
