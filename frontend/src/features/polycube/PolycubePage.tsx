import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, ConfirmDialog, Input, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  PALETTE,
  cellOwners,
  composeRotation,
  findPlacementAt,
  getAllRotations,
  getTransformedCells,
  isValidPlacement,
  loadBoardSession,
  loadLibrary,
  normalizeCells,
  saveBoardSession,
  saveLibrary,
  type BoardState,
  type Cell,
  type Piece,
} from './lib/polycubeEngine'
import { CubeView3D } from './components/CubeView3D'
import { LayerBoard } from './components/LayerBoard'
import { LayerInspector } from './components/LayerInspector'
import { ActivePiecePanel } from './components/ActivePiecePanel'
import { PieceLibrary } from './components/PieceLibrary'
import { PieceDesigner } from './components/PieceDesigner'
import type { ActiveSelection, HoveredCell } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Matches Tailwind's `lg` breakpoint (≤ 1023px is the touch / mobile layout). */
function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

export default function PolycubePage() {
  const toast = useToast()
  const isMobile = useIsMobile()

  const [library, setLibrary] = useState<Piece[]>(() => loadLibrary())
  const [board, setBoard] = useState<BoardState>(() => loadBoardSession())
  const [active, setActive] = useState<ActiveSelection | null>(null)
  const [activeY, setActiveY] = useState(0)
  const [hovered, setHovered] = useState<HoveredCell | null>(null)
  const paletteIdx = useRef(library.length)

  const [xInput, setXInput] = useState(String(board.sx))
  const [yInput, setYInput] = useState(String(board.sy))
  const [zInput, setZInput] = useState(String(board.sz))
  const [designerOpen, setDesignerOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Piece | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [opacity, setOpacity] = useState(() => {
    const v = Number(localStorage.getItem('polycube_opacity'))
    return v >= 0.1 && v <= 1 ? v : 1
  })
  const fileRef = useRef<HTMLInputElement>(null)

  // Persist.
  useEffect(() => saveBoardSession(board), [board])
  useEffect(() => saveLibrary(library), [library])
  useEffect(() => {
    localStorage.setItem('polycube_opacity', String(opacity))
  }, [opacity])
  // Keep the active layer inside the board.
  useEffect(() => setActiveY((y) => clamp(y, 0, board.sy - 1)), [board.sy])

  const activePiece = useMemo(
    () => (active ? library.find((p) => p.id === active.pieceId) ?? null : null),
    [active, library],
  )

  const owners = useMemo(() => cellOwners(board, library), [board, library])
  const filled = owners.size
  const total = board.sx * board.sy * board.sz
  const usage = useCallback(
    (id: string) => board.placements.filter((p) => p.pieceId === id).length,
    [board.placements],
  )
  const legend = useMemo(() => {
    const ids = new Set(board.placements.map((p) => p.pieceId))
    return [...ids].map((id) => library.find((p) => p.id === id)).filter((p): p is Piece => Boolean(p))
  }, [board.placements, library])

  // 3D ghost (driven by the layer board's hovered cell).
  const ghost = useMemo(() => {
    if (!active || !activePiece || !hovered) return { cells: [] as [number, number, number][], valid: false }
    const cells = getTransformedCells(activePiece, active.rotIdx)
    const valid = isValidPlacement(board, library, activePiece.id, hovered.x, activeY, hovered.z, active.rotIdx)
    return {
      cells: cells.map(([dx, dy, dz]) => [hovered.x + dx, activeY + dy, hovered.z + dz] as [number, number, number]),
      valid,
    }
  }, [active, activePiece, hovered, board, library, activeY])

  // ── Selection / rotation ──
  const selectPiece = useCallback((id: string) => {
    setActive((prev) => (prev?.pieceId === id ? null : { pieceId: id, rotIdx: 0 }))
    if (window.innerWidth <= 1024) setDrawerOpen(false)
  }, [])
  const deselect = useCallback(() => setActive(null), [])
  const rotateActive = useCallback((axis: 'x' | 'y' | 'z', dir: 1 | -1) => {
    setActive((a) => (a ? { ...a, rotIdx: composeRotation(a.rotIdx, axis, dir) } : a))
  }, [])
  // Tap the active piece preview → step through the 24 orientations.
  const cycleRot = useCallback(() => {
    const n = getAllRotations().length
    setActive((a) => (a ? { ...a, rotIdx: (a.rotIdx + 1) % n } : a))
  }, [])

  // ── Mobile tap-to-place on the 3D surface ──
  const placeTarget = useCallback(
    (target: Cell) => {
      if (!active) return
      const origin = findPlacementAt(board, library, active.pieceId, active.rotIdx, target)
      if (!origin) {
        toast('放不下：越界或与已有积木块重叠', 'danger')
        return
      }
      setBoard((b) => ({
        ...b,
        placements: [
          ...b.placements,
          { pieceId: active.pieceId, ox: origin[0], oy: origin[1], oz: origin[2], rotIdx: active.rotIdx },
        ],
      }))
    },
    [active, board, library, toast],
  )
  const removeCell = useCallback(
    (cell: Cell) => {
      const o = owners.get(`${cell[0]},${cell[1]},${cell[2]}`)
      if (!o) return
      setBoard((b) => ({ ...b, placements: b.placements.filter((_, i) => i !== o.index) }))
    },
    [owners],
  )

  // ── Placement / removal ──
  const placeAt = useCallback(
    (x: number, z: number) => {
      if (!active) return
      setBoard((b) => {
        if (!isValidPlacement(b, library, active.pieceId, x, activeY, z, active.rotIdx)) return b
        return {
          ...b,
          placements: [...b.placements, { pieceId: active.pieceId, ox: x, oy: activeY, oz: z, rotIdx: active.rotIdx }],
        }
      })
    },
    [active, library, activeY],
  )
  const removeAt = useCallback(
    (x: number, z: number) => {
      const o = owners.get(`${x},${activeY},${z}`)
      if (!o) return
      setBoard((b) => ({ ...b, placements: b.placements.filter((_, i) => i !== o.index) }))
    },
    [owners, activeY],
  )
  const undo = useCallback(() => {
    setBoard((b) => (b.placements.length ? { ...b, placements: b.placements.slice(0, -1) } : b))
  }, [])

  // ── Board size ──
  const commitDims = useCallback(() => {
    const sx = clamp(parseInt(xInput) || board.sx, 1, 10)
    const sy = clamp(parseInt(yInput) || board.sy, 1, 10)
    const sz = clamp(parseInt(zInput) || board.sz, 1, 10)
    setXInput(String(sx))
    setYInput(String(sy))
    setZInput(String(sz))
    setBoard((b) => {
      let removed = 0
      const placements = b.placements.filter((pl) => {
        const piece = library.find((p) => p.id === pl.pieceId)
        if (!piece) return false
        const ok = getTransformedCells(piece, pl.rotIdx).every(
          ([dx, dy, dz]) =>
            pl.ox + dx >= 0 && pl.ox + dx < sx &&
            pl.oy + dy >= 0 && pl.oy + dy < sy &&
            pl.oz + dz >= 0 && pl.oz + dz < sz,
        )
        if (!ok) removed++
        return ok
      })
      if (removed > 0) toast(`棋盘缩小，移除了 ${removed} 个越界积木块`, 'danger')
      return { sx, sy, sz, placements }
    })
    setResetKey((k) => k + 1)
  }, [xInput, yInput, zInput, board.sx, board.sy, board.sz, library, toast])

  // ── Session / library IO ──
  const saveSession = () => {
    saveBoardSession(board)
    saveLibrary(library)
    toast('已保存当前棋盘与积木库', 'success')
  }
  const loadSession = () => {
    const b = loadBoardSession()
    setBoard(b)
    setXInput(String(b.sx))
    setYInput(String(b.sy))
    setZInput(String(b.sz))
    setActive(null)
    toast('已载入上次保存的棋盘', 'success')
  }
  const saveDesigned = (cells: Cell[], name: string) => {
    if (cells.length === 0) return
    const color = PALETTE[paletteIdx.current % PALETTE.length]
    paletteIdx.current += 1
    const id = 'pc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    const piece: Piece = { id, name: name || `积木块 ${library.length + 1}`, cells: normalizeCells(cells), color }
    setLibrary((l) => [...l, piece])
    setActive({ pieceId: id, rotIdx: 0 })
    toast('已保存积木块', 'success')
  }
  const requestDelete = (id: string) => {
    const piece = library.find((p) => p.id === id)
    if (!piece) return
    if (usage(id) > 0) setPendingDelete(piece)
    else doDelete(piece)
  }
  const doDelete = (piece: Piece) => {
    setBoard((b) => ({ ...b, placements: b.placements.filter((p) => p.pieceId !== piece.id) }))
    setLibrary((l) => l.filter((p) => p.id !== piece.id))
    setActive((a) => (a?.pieceId === piece.id ? null : a))
    setPendingDelete(null)
  }
  const exportLibrary = () => {
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'polycube-pieces.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importLibrary = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(String(e.target?.result))
        if (!Array.isArray(data)) throw new Error('格式错误')
        let added = 0
        setLibrary((prev) => {
          const next = [...prev]
          for (const p of data) {
            if (!p?.id || !Array.isArray(p.cells)) continue
            if (next.some((x) => x.id === p.id)) continue
            next.push(p)
            added++
          }
          return next
        })
        toast(`导入完成：新增 ${added} 个积木块`, 'success')
      } catch (err) {
        toast('导入失败：' + (err as Error).message, 'danger')
      }
    }
    reader.readAsText(file)
  }

  // ── Keyboard: arrows rotate, ,/. rotate Z, Esc deselect, Ctrl+Z undo ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape') return deselect()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        return undo()
      }
      if (!active) return
      const map: Record<string, ['x' | 'y' | 'z', 1 | -1]> = {
        ArrowUp: ['x', 1], ArrowDown: ['x', -1],
        ArrowRight: ['y', 1], ArrowLeft: ['y', -1],
        '.': ['z', 1], ',': ['z', -1],
      }
      const m = map[e.key]
      if (m) {
        e.preventDefault()
        rotateActive(m[0], m[1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, deselect, undo, rotateActive])

  const sidebar = (
    <div className="flex flex-col gap-4">
      {!isMobile && active && activePiece && (
        <ActivePiecePanel
          piece={activePiece}
          active={active}
          usage={usage(active.pieceId)}
          onRotate={rotateActive}
          onCycle={cycleRot}
          onDeselect={deselect}
        />
      )}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">积木库</h2>
        <PieceLibrary
          library={library}
          activeId={active?.pieceId ?? null}
          usage={usage}
          onSelect={selectPiece}
          onDelete={requestDelete}
        />
      </div>
      <div className="border-t border-border-soft pt-3">
        <button
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted hover:text-fg"
          onClick={() => setDesignerOpen((o) => !o)}
        >
          <span>积木块设计器</span>
          <span className={cn('transition-transform', designerOpen && 'rotate-90')}>›</span>
        </button>
        {designerOpen && (
          <div className="mt-3">
            <PieceDesigner onSave={saveDesigned} />
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border-soft pt-3">
        <Button variant="outline" size="sm" className="flex-1" onClick={exportLibrary}>
          导出库
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
          导入库
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importLibrary(f)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">
          Tiling Studio · 立体堆砌
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">立方体堆砌工作台</h1>
        <p className="mt-2 max-w-2xl text-muted">
          为竞赛装箱 / 堆砌问题设计立方块、逐层精确摆放。左侧逐层放置，右侧 3D 实时呈现，
          下方层切片可直接核对盒内填充。
        </p>
      </header>

      <div className="mb-4 lg:hidden">
        <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
          打开积木库
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setDrawerOpen(false)} />
        )}
        <aside
          className={cn(
            'card w-[300px] shrink-0 overflow-y-auto p-4',
            'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[88vw] max-lg:max-w-[340px] max-lg:rounded-none max-lg:transition-transform',
            drawerOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
          )}
        >
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <span className="text-sm font-semibold">积木库</span>
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>
              关闭
            </Button>
          </div>
          {sidebar}
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border-soft bg-surface p-3">
            <DimField label="X" value={xInput} onChange={setXInput} onEnter={commitDims} />
            <DimField label="Y(高)" value={yInput} onChange={setYInput} onEnter={commitDims} />
            <DimField label="Z" value={zInput} onChange={setZInput} onEnter={commitDims} />
            <Button variant="secondary" onClick={commitDims}>
              更新棋盘
            </Button>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">透明度 {Math.round(opacity * 100)}%</span>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="h-9 w-24 accent-[var(--color-accent)]"
                title="调整方块透明度，便于查看内层"
              />
            </label>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={undo} disabled={board.placements.length === 0}>
                撤销
              </Button>
              <Button
                variant="ghost"
                className="text-danger hover:bg-danger/10"
                onClick={() => board.placements.length && setClearConfirm(true)}
                disabled={board.placements.length === 0}
              >
                清空
              </Button>
              <Button variant="ghost" onClick={() => setResetKey((k) => k + 1)}>
                重置视角
              </Button>
              <Button variant="secondary" onClick={saveSession}>
                保存
              </Button>
              <Button variant="secondary" onClick={loadSession}>
                载入
              </Button>
            </div>
          </div>

          {isMobile ? (
            <div className="space-y-4">
              {active && activePiece ? (
                <ActivePiecePanel
                  piece={activePiece}
                  active={active}
                  usage={usage(active.pieceId)}
                  onRotate={rotateActive}
                  onCycle={cycleRot}
                  onDeselect={deselect}
                />
              ) : (
                <div className="rounded-xl border border-border-soft bg-surface p-3 text-sm text-muted">
                  点{' '}
                  <button
                    className="font-medium text-accent underline-offset-2 hover:underline"
                    onClick={() => setDrawerOpen(true)}
                  >
                    积木库
                  </button>{' '}
                  选一个积木块，再点下面 3D 直接放置；未选中时点方块可删除。
                </div>
              )}

              <div className="card h-[58vh] min-h-[360px] overflow-hidden p-0">
                <CubeView3D
                  board={board}
                  library={library}
                  activeY={activeY}
                  ghost={ghost}
                  resetKey={resetKey}
                  opacity={opacity}
                  interactive
                  hasActive={!!active}
                  onPlace={placeTarget}
                  onRemove={removeCell}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={filled === total ? 'success' : 'neutral'}>
                  已填 {filled} / {total}
                </Badge>
                <Badge tone="neutral">空 {total - filled}</Badge>
                {legend.map((p) => (
                  <Badge key={p.id} tone="neutral" className="gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: p.color }} />
                    {p.name} ({usage(p.id)})
                  </Badge>
                ))}
              </div>

              <p className="text-xs text-faint">
                点方块顶 / 侧面 → 沿该面方向贴放 · 点地面 → 落到底层 · 取消选择后点方块即删除 ·
                单指拖动旋转视角、双指缩放 · 点上方积木块预览循环切换朝向。
              </p>
            </div>
          ) : (
          <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Layer editor */}
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-sm font-medium">
                  放置层 <span className="font-mono text-accent">Y = {activeY}</span>
                </span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setActiveY((y) => clamp(y - 1, 0, board.sy - 1))} disabled={activeY === 0}>
                    ↓
                  </Button>
                  <input
                    type="range"
                    min={0}
                    max={board.sy - 1}
                    value={activeY}
                    onChange={(e) => setActiveY(Number(e.target.value))}
                    className="w-28 accent-[var(--color-accent)]"
                  />
                  <Button size="sm" variant="ghost" onClick={() => setActiveY((y) => clamp(y + 1, 0, board.sy - 1))} disabled={activeY === board.sy - 1}>
                    ↑
                  </Button>
                </div>
              </div>
              <LayerBoard
                board={board}
                library={library}
                active={active}
                activeY={activeY}
                hovered={hovered}
                onHover={setHovered}
                onPlace={placeAt}
                onRemoveAt={removeAt}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={filled === total ? 'success' : 'neutral'}>
                  已填 {filled} / {total}
                </Badge>
                <Badge tone="neutral">空 {total - filled}</Badge>
                {legend.map((p) => (
                  <Badge key={p.id} tone="neutral" className="gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: p.color }} />
                    {p.name} ({usage(p.id)})
                  </Badge>
                ))}
              </div>
            </div>

            {/* 3D view */}
            <div className="card h-[360px] overflow-hidden p-0 lg:h-[460px]">
              <CubeView3D
                board={board}
                library={library}
                activeY={activeY}
                ghost={ghost}
                resetKey={resetKey}
                opacity={opacity}
              />
            </div>
          </div>

          {/* Layer cross-sections */}
          <div className="mt-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              层切片（点击切换放置层 · 顶→底）
            </h2>
            <LayerInspector board={board} library={library} activeY={activeY} onPick={setActiveY} />
          </div>

          <p className="mt-5 text-xs text-faint">
            操作：左侧网格点击放置 / 点已填格移除 · 选中块后方向键旋转（↑↓绕X、←→绕Y、, .绕Z）· Esc 取消 · Ctrl+Z 撤销 ·
            右侧可拖动旋转视角、滚轮缩放。绿色=有效，红色=越界或重叠，紫框=该块在更高层。
          </p>
          </>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={clearConfirm}
        title="清空棋盘"
        message={`确定清空棋盘上的 ${board.placements.length} 个积木块吗？`}
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
        title="删除积木块"
        message={pendingDelete ? `"${pendingDelete.name}" 已在棋盘上使用 ${usage(pendingDelete.id)} 次，删除会一并移除。确定？` : ''}
        confirmLabel="删除"
        danger
        onConfirm={() => pendingDelete && doDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

function DimField({
  label,
  value,
  onChange,
  onEnter,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onEnter: () => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <Input
        type="number"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        className="w-20"
      />
    </label>
  )
}
