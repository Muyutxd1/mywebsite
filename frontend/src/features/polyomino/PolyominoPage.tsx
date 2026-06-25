import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, ConfirmDialog, Input, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { BoardCanvas } from './components/BoardCanvas'
import { ActivePiecePanel } from './components/ActivePiecePanel'
import { PieceLibrary } from './components/PieceLibrary'
import { PieceDesigner } from './components/PieceDesigner'
import {
  DEFAULT_PALETTE,
  countPieceUsage,
  getTransformedCoords,
  importPieces,
  isConnected,
  isValidPlacement,
  loadBoardSession,
  loadLibrary,
  saveBoardSession,
  saveLibrary,
} from './lib/polyominoMath'
import type { ActiveSelection, BoardState, Coord, Piece } from './types'

export default function PolyominoPage() {
  const toast = useToast()

  // ── Core state ──
  const [library, setLibrary] = useState<Piece[]>(() => loadLibrary())
  const [board, setBoard] = useState<BoardState>(() => loadBoardSession())
  const [active, setActive] = useState<ActiveSelection | null>(null)
  const paletteIdxRef = useRef<number>(library.length)

  // ── UI state ──
  const [rowsInput, setRowsInput] = useState(String(board.rows))
  const [colsInput, setColsInput] = useState(String(board.cols))
  const [designerOpen, setDesignerOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Piece | null>(null)
  const [resizeConfirm, setResizeConfirm] = useState<{
    rows: number
    cols: number
    valid: BoardState['placements']
    clipped: number
  } | null>(null)
  const [connectConfirm, setConnectConfirm] = useState<{ shape: Coord[]; name: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Persist on change.
  useEffect(() => {
    saveLibrary(library)
  }, [library])
  useEffect(() => {
    saveBoardSession(board)
  }, [board])

  // Auto-save on unload (mirrors legacy beforeunload).
  useEffect(() => {
    const onUnload = () => {
      saveBoardSession(board)
      saveLibrary(library)
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [board, library])

  const activePiece = useMemo(
    () => (active ? library.find((p) => p.id === active.pieceId) ?? null : null),
    [active, library],
  )

  // ── Selection / transforms ──
  const selectPiece = useCallback(
    (pieceId: string) => {
      setActive((prev) =>
        prev && prev.pieceId === pieceId
          ? null
          : { pieceId, rotation: 0, flipH: false, flipV: false },
      )
      if (window.innerWidth <= 800) setDrawerOpen(false)
    },
    [],
  )

  const rotateActive = useCallback(() => {
    setActive((a) => (a ? { ...a, rotation: (a.rotation + 1) % 4 } : a))
  }, [])
  const flipActiveH = useCallback(() => {
    setActive((a) => (a ? { ...a, flipH: !a.flipH } : a))
  }, [])
  const flipActiveV = useCallback(() => {
    setActive((a) => (a ? { ...a, flipV: !a.flipV } : a))
  }, [])
  const deselectActive = useCallback(() => setActive(null), [])

  // ── Placement / undo / clear ──
  const placeAt = useCallback(
    (r: number, c: number) => {
      setActive((a) => {
        if (!a) return a
        setBoard((b) => {
          if (!isValidPlacement(b, library, a.pieceId, r, c, a.rotation, a.flipH, a.flipV)) return b
          return {
            ...b,
            placements: [
              ...b.placements,
              { pieceId: a.pieceId, originR: r, originC: c, rotation: a.rotation, flipH: a.flipH, flipV: a.flipV },
            ],
          }
        })
        return a // piece stays selected for repeated placement
      })
    },
    [library],
  )

  const undo = useCallback(() => {
    setBoard((b) =>
      b.placements.length === 0 ? b : { ...b, placements: b.placements.slice(0, -1) },
    )
  }, [])

  const doClear = useCallback(() => {
    if (board.placements.length === 0) return
    setClearConfirm(true)
  }, [board.placements.length])

  // ── Delete piece ──
  const requestDelete = useCallback(
    (pieceId: string) => {
      const piece = library.find((p) => p.id === pieceId)
      if (!piece) return
      if (countPieceUsage(board, pieceId) > 0) {
        setPendingDelete(piece)
      } else {
        confirmDelete(piece)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library, board],
  )

  function confirmDelete(piece: Piece) {
    setBoard((b) => ({ ...b, placements: b.placements.filter((p) => p.pieceId !== piece.id) }))
    setLibrary((lib) => lib.filter((p) => p.id !== piece.id))
    setActive((a) => (a && a.pieceId === piece.id ? null : a))
    setPendingDelete(null)
  }

  // ── Board size ──
  function commitBoardSize() {
    const newRows = parseInt(rowsInput) || 8
    const newCols = parseInt(colsInput) || 8
    const clampedRows = Math.max(2, Math.min(50, newRows))
    const clampedCols = Math.max(2, Math.min(50, newCols))
    setRowsInput(String(clampedRows))
    setColsInput(String(clampedCols))
    if (clampedRows === board.rows && clampedCols === board.cols) return

    const valid: BoardState['placements'] = []
    let clipped = 0
    for (const pl of board.placements) {
      const piece = library.find((p) => p.id === pl.pieceId)
      if (!piece) continue
      const coords = getTransformedCoords(piece.shape, pl.rotation, pl.flipH, pl.flipV)
      let ok = true
      for (const [dr, dc] of coords) {
        const r = pl.originR + dr
        const c = pl.originC + dc
        if (r < 0 || r >= clampedRows || c < 0 || c >= clampedCols) {
          ok = false
          break
        }
      }
      if (ok) valid.push(pl)
      else clipped++
    }
    if (clipped > 0) {
      setResizeConfirm({ rows: clampedRows, cols: clampedCols, valid, clipped })
      return
    }
    setBoard((b) => ({ ...b, rows: clampedRows, cols: clampedCols, placements: valid }))
  }

  // ── Session ──
  function saveSession() {
    saveBoardSession(board)
    saveLibrary(library)
    toast('已保存当前棋盘与拼图库', 'success')
  }
  function loadSession() {
    const b = loadBoardSession()
    setBoard(b)
    setRowsInput(String(b.rows))
    setColsInput(String(b.cols))
    setActive(null)
    toast('已载入上次保存的棋盘', 'success')
  }

  // ── Designer save ──
  function saveDesignedPiece(shape: Coord[], name: string): boolean {
    if (shape.length === 0) {
      toast('请先在网格中选择至少一个格子', 'danger')
      return false
    }
    if (!isConnected(shape)) {
      setConnectConfirm({ shape, name })
      return false
    }
    commitNewPiece(shape, name)
    return true
  }

  function commitNewPiece(shape: Coord[], name: string) {
    const finalName = name || '拼图块 ' + (library.length + 1)
    const color = DEFAULT_PALETTE[paletteIdxRef.current % DEFAULT_PALETTE.length]
    paletteIdxRef.current += 1
    const id = 'piece_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    const piece: Piece = { id, name: finalName, shape, color }
    setLibrary((lib) => [...lib, piece])
    setActive({ pieceId: id, rotation: 0, flipH: false, flipV: false })
  }

  // ── Export / import ──
  function exportLibrary() {
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'polyomino-pieces.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(String(e.target?.result))
        const res = importPieces(library, data, paletteIdxRef.current)
        paletteIdxRef.current = res.paletteIdx
        setLibrary(res.library)
        toast(`导入完成：新增 ${res.added} 个，跳过 ${res.skipped} 个重复`, 'success')
      } catch (err) {
        toast('导入失败：无效的 JSON 文件 — ' + (err as Error).message, 'danger')
      }
    }
    reader.readAsText(file)
  }

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      switch (e.key.toLowerCase()) {
        case 'r':
          rotateActive()
          break
        case 'h':
          flipActiveH()
          break
        case 'v':
          flipActiveV()
          break
        case 'escape':
          deselectActive()
          break
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            undo()
          }
          break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [rotateActive, flipActiveH, flipActiveV, deselectActive, undo])

  const usage = useCallback((id: string) => countPieceUsage(board, id), [board])

  // Pieces actually on the board (legend).
  const legend = useMemo(() => {
    const ids = new Set(board.placements.map((p) => p.pieceId))
    return [...ids]
      .map((id) => library.find((p) => p.id === id))
      .filter((p): p is Piece => Boolean(p))
  }, [board.placements, library])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">
          Tiling Studio · 多联骨牌
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">多联骨牌拼图工坊</h1>
        <p className="mt-2 max-w-2xl text-muted">
          为竞赛覆盖与铺砌问题设计拼图块、在棋盘上自由摆放。支持旋转翻转、自定义形状与本地保存。
        </p>
      </header>

      {/* Mobile sidebar toggle */}
      <div className="mb-4 lg:hidden">
        <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
          打开拼图库
        </Button>
      </div>

      <div className="flex gap-6">
        {/* ── Sidebar (drawer on mobile) ── */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <aside
          className={cn(
            'card flex w-[300px] shrink-0 flex-col gap-4 overflow-y-auto p-4',
            'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[88vw] max-lg:max-w-[340px] max-lg:rounded-none max-lg:transition-transform',
            drawerOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between lg:hidden">
            <span className="text-sm font-semibold">拼图库</span>
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>
              关闭
            </Button>
          </div>

          {/* Active piece panel */}
          {active && activePiece && (
            <ActivePiecePanel
              active={active}
              piece={activePiece}
              usage={usage(active.pieceId)}
              onRotate={rotateActive}
              onFlipH={flipActiveH}
              onFlipV={flipActiveV}
              onDeselect={deselectActive}
            />
          )}

          {/* Library */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">拼图库</h2>
            <PieceLibrary
              library={library}
              activePieceId={active?.pieceId ?? null}
              usage={usage}
              onSelect={selectPiece}
              onDelete={requestDelete}
            />
          </div>

          {/* Designer (collapsible) */}
          <div className="border-t border-border-soft pt-3">
            <button
              className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted hover:text-fg"
              onClick={() => setDesignerOpen((o) => !o)}
            >
              <span>拼图设计器</span>
              <span className={cn('transition-transform', designerOpen && 'rotate-90')}>›</span>
            </button>
            {designerOpen && (
              <div className="mt-3">
                <PieceDesigner onSave={saveDesignedPiece} />
              </div>
            )}
          </div>

          {/* Export / import */}
          <div className="flex gap-2 border-t border-border-soft pt-3">
            <Button variant="outline" size="sm" onClick={exportLibrary} className="flex-1">
              导出库
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex-1">
              导入库
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleImportFile(f)
                e.target.value = ''
              }}
            />
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border-soft bg-surface p-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">行</span>
              <Input
                type="number"
                min={2}
                max={50}
                value={rowsInput}
                onChange={(e) => setRowsInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitBoardSize()}
                className="w-20"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">列</span>
              <Input
                type="number"
                min={2}
                max={50}
                value={colsInput}
                onChange={(e) => setColsInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitBoardSize()}
                className="w-20"
              />
            </label>
            <Button variant="secondary" onClick={commitBoardSize}>
              更新棋盘
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={undo} disabled={board.placements.length === 0}>
                撤销
              </Button>
              <Button
                variant="ghost"
                onClick={doClear}
                disabled={board.placements.length === 0}
                className="text-danger hover:bg-danger/10"
              >
                清空
              </Button>
              <Button variant="secondary" onClick={saveSession}>
                保存
              </Button>
              <Button variant="secondary" onClick={loadSession}>
                载入
              </Button>
            </div>
          </div>

          {/* Board */}
          <BoardCanvas
            board={board}
            library={library}
            active={active}
            onPlace={placeAt}
            onDeselect={deselectActive}
          />

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {legend.length === 0 ? (
              <span className="text-xs text-muted">棋盘为空 — 从左侧选择拼图块开始摆放</span>
            ) : (
              legend.map((p) => (
                <Badge key={p.id} tone="neutral" className="gap-1.5">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name} ({usage(p.id)})
                </Badge>
              ))
            )}
          </div>

          <p className="mt-4 text-xs text-faint">
            快捷键：R 旋转 · H 水平翻转 · V 垂直翻转 · Esc 取消 · Ctrl+Z 撤销 · 右键取消选择。
            选中拼图块后在棋盘上点击放置（绿色=有效，红色=越界或重叠）。
          </p>
        </main>
      </div>

      {/* ── Modals ── */}
      <ConfirmDialog
        open={clearConfirm}
        title="清空棋盘"
        message={`确定要清空棋盘上的 ${board.placements.length} 个拼图块吗？`}
        confirmLabel="清空"
        danger
        onConfirm={() => {
          setBoard((b) => ({ ...b, placements: [] }))
          setClearConfirm(false)
        }}
        onCancel={() => setClearConfirm(false)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除拼图块"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" 已在棋盘上使用了 ${countPieceUsage(board, pendingDelete.id)} 次。删除会同时移除棋盘上对应的拼图。确定删除吗？`
            : ''
        }
        confirmLabel="删除"
        danger
        onConfirm={() => pendingDelete && confirmDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={resizeConfirm !== null}
        title="更改棋盘尺寸"
        message={
          resizeConfirm
            ? `更改棋盘尺寸将移除 ${resizeConfirm.clipped} 个超出边界的拼图块。确定继续吗？`
            : ''
        }
        confirmLabel="继续"
        danger
        onConfirm={() => {
          if (resizeConfirm) {
            setBoard((b) => ({
              ...b,
              rows: resizeConfirm.rows,
              cols: resizeConfirm.cols,
              placements: resizeConfirm.valid,
            }))
          }
          setResizeConfirm(null)
        }}
        onCancel={() => {
          setRowsInput(String(board.rows))
          setColsInput(String(board.cols))
          setResizeConfirm(null)
        }}
      />

      <ConfirmDialog
        open={connectConfirm !== null}
        title="形状不连通"
        message="设计的形状不是连通的（格子必须边相邻连接在一起）。确定要保存吗？"
        confirmLabel="仍然保存"
        onConfirm={() => {
          if (connectConfirm) commitNewPiece(connectConfirm.shape, connectConfirm.name)
          setConnectConfirm(null)
        }}
        onCancel={() => setConnectConfirm(null)}
      />
    </div>
  )
}
