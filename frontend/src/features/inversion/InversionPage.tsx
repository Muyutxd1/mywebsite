import { useCallback, useRef, useState } from 'react'
import { Button, ConfirmDialog } from '@/components/ui'
import { cn } from '@/lib/cn'
import { InversionCanvas } from './components/InversionCanvas'
import type { InversionHandle } from './components/InversionCanvas'
import { Sidebar } from './components/Sidebar'
import type { Tool } from './types'

export default function InversionPage() {
  const engine = useRef<InversionHandle>(null)

  // Default active tool = invCenter (matches legacy).
  const [tool, setTool] = useState<Tool>('invCenter')
  // Mirror of cx/cy/R for the sliders' readouts (two-way synced with canvas).
  const [circle, setCircle] = useState({ cx: 0, cy: 0, R: 2 })
  const [hasSelection, setHasSelection] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Canvas → React: live circle values from drag / placement.
  const onCircleChange = useCallback((c: { cx: number; cy: number; R: number }) => {
    setCircle(c)
  }, [])

  // Sidebar slider → canvas engine (imperative, no canvas re-render).
  const onCircleInput = useCallback((next: { cx: number; cy: number; R: number }) => {
    setCircle(next)
    engine.current?.setCircle(next.cx, next.cy, next.R)
  }, [])

  const onToolChange = useCallback((t: Tool) => setTool(t), [])

  const sidebar = (
    <Sidebar
      tool={tool}
      onToolChange={(t) => {
        onToolChange(t)
        setDrawerOpen(false)
      }}
      cx={circle.cx}
      cy={circle.cy}
      R={circle.R}
      onCircleInput={onCircleInput}
      onFit={() => engine.current?.fit()}
      onDelete={() => engine.current?.deleteSelected()}
      onClear={() => setConfirmClear(true)}
      hasSelection={hasSelection}
    />
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">
          Geometry · 反演变换
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">反演操作台</h1>
        <p className="mt-2 max-w-2xl text-muted">
          以一个圆为镜，实时观察点、线段与圆在反演变换下的像。拖动反演圆，
          看直线如何弯成过圆心的圆、圆又如何彼此互换。
        </p>
      </header>

      <div className="flex gap-5">
        {/* Desktop sidebar (~210px) */}
        <aside className="hidden w-[210px] shrink-0 lg:block">{sidebar}</aside>

        {/* Canvas + mobile controls */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2 lg:hidden">
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
              ☰ 工具与反演圆
            </Button>
            <span className="text-xs text-muted">
              {labelForTool(tool)}
            </span>
          </div>

          <div className="card relative h-[60vh] min-h-[420px] overflow-hidden p-1.5 sm:h-[68vh]">
            <InversionCanvas
              handleRef={engine}
              tool={tool}
              onToolChange={onToolChange}
              onCircleChange={onCircleChange}
              onSelectionChange={setHasSelection}
            />
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_.15s_ease-out]"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className={cn(
              'absolute left-0 top-0 h-full w-[260px] max-w-[82vw] overflow-y-auto',
              'glass border-r border-border p-4 animate-[fadeIn_.2s_var(--ease-out)]',
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">反演操作台</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg px-2 py-1 text-fg-soft hover:bg-surface-2"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="清空所有图形"
        message="确定要删除画布上的全部图形吗？此操作无法撤销。"
        confirmLabel="清空"
        danger
        onConfirm={() => {
          engine.current?.clearAll()
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}

function labelForTool(t: Tool): string {
  switch (t) {
    case 'select':
      return '选择 / 移动'
    case 'point':
      return '画点'
    case 'segment':
      return '画线段'
    case 'circle':
      return '画圆'
    case 'invCenter':
      return '反演中心'
  }
}
