import type { ReactNode } from 'react'
import { Button, Slider } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Tool } from '../types'

interface ToolDef {
  id: Tool
  key: string
  label: string
  hint: string
}

const TOOLS: ToolDef[] = [
  { id: 'select', key: 'V', label: '选择 / 移动', hint: '拖动点、圆心、半径手柄' },
  { id: 'point', key: 'P', label: '画点', hint: '单击放置一个点' },
  { id: 'segment', key: 'S', label: '画线段', hint: '两次单击确定端点' },
  { id: 'circle', key: 'C', label: '画圆', hint: '先点圆心，再点半径' },
  { id: 'invCenter', key: 'I', label: '反演中心', hint: '点击设圆心，拖动定半径' },
]

interface Props {
  tool: Tool
  onToolChange: (t: Tool) => void
  cx: number
  cy: number
  R: number
  onCircleInput: (next: { cx: number; cy: number; R: number }) => void
  onFit: () => void
  onDelete: () => void
  onClear: () => void
  hasSelection: boolean
}

export function Sidebar({
  tool,
  onToolChange,
  cx,
  cy,
  R,
  onCircleInput,
  onFit,
  onDelete,
  onClear,
  hasSelection,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      {/* Tools */}
      <section>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-faint">工具</p>
        <div className="flex flex-col gap-1.5">
          {TOOLS.map((t) => {
            const active = tool === t.id
            return (
              <button
                key={t.id}
                onClick={() => onToolChange(t.id)}
                className={cn(
                  'group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all',
                  active
                    ? 'border-accent/50 bg-accent-soft text-fg shadow-[var(--shadow-glow)]'
                    : 'border-border-soft bg-surface-2 text-fg-soft hover:border-border hover:bg-surface-3',
                )}
                title={t.hint}
              >
                <span className="font-medium">{t.label}</span>
                <kbd
                  className={cn(
                    'rounded px-1.5 py-0.5 font-mono text-[10px]',
                    active ? 'bg-accent/20 text-accent' : 'bg-surface-3 text-faint',
                  )}
                >
                  {t.key}
                </kbd>
              </button>
            )
          })}
        </div>
      </section>

      {/* Inversion circle controls */}
      <section className="rounded-xl border border-border-soft bg-surface-2 p-3">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-faint">反演圆</p>
        <div className="flex flex-col gap-3">
          <Slider
            label="圆心 cx"
            valueLabel={cx.toFixed(1)}
            min={-8}
            max={8}
            step={0.1}
            value={cx}
            onChange={(e) => onCircleInput({ cx: parseFloat(e.target.value), cy, R })}
          />
          <Slider
            label="圆心 cy"
            valueLabel={cy.toFixed(1)}
            min={-8}
            max={8}
            step={0.1}
            value={cy}
            onChange={(e) => onCircleInput({ cx, cy: parseFloat(e.target.value), R })}
          />
          <Slider
            label="半径 R"
            valueLabel={R.toFixed(1)}
            min={0.2}
            max={8}
            step={0.1}
            value={R}
            onChange={(e) => onCircleInput({ cx, cy, R: parseFloat(e.target.value) })}
          />
        </div>
      </section>

      {/* Actions */}
      <section className="flex flex-col gap-1.5">
        <Button variant="secondary" size="sm" onClick={onFit}>
          适配视图
          <kbd className="ml-auto rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-faint">
            F
          </kbd>
        </Button>
        <Button variant="secondary" size="sm" onClick={onDelete} disabled={!hasSelection}>
          删除所选
          <kbd className="ml-auto rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-faint">
            Del
          </kbd>
        </Button>
        <Button variant="danger" size="sm" onClick={onClear}>
          清空全部
        </Button>
      </section>

      {/* Legend */}
      <section className="rounded-xl border border-border-soft bg-surface-2 p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-faint">图例</p>
        <ul className="flex flex-col gap-1.5 text-xs text-fg-soft">
          <LegendRow color="#5aa9ff" label="原图形" />
          <LegendRow color="#f0616d" label="反演像" />
          <LegendRow color="#a78bff" label="反演圆（虚线）" dashed />
        </ul>
      </section>

      {/* Shortcuts */}
      <section>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-faint">快捷键</p>
        <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-muted">
          <li>
            <Kbd>V/P/S/C/I</Kbd> 切换工具
          </li>
          <li>
            <Kbd>F</Kbd> 适配视图 · <Kbd>Esc</Kbd> 取消
          </li>
          <li>
            <Kbd>Del</Kbd> / <Kbd>⌫</Kbd> 删除所选
          </li>
          <li>滚轮缩放 · 右键 / 空白拖动平移 · 双指捏合缩放</li>
        </ul>
      </section>
    </div>
  )
}

function LegendRow({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className="inline-block h-0 w-6 shrink-0"
        style={{
          borderTop: `2.5px ${dashed ? 'dashed' : 'solid'} ${color}`,
        }}
      />
      <span>{label}</span>
    </li>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[10px] text-fg-soft">
      {children}
    </kbd>
  )
}
