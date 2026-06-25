import { Button, Slider } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PRESETS, type Mat } from '../lib/affineMath'
import { MatrixDisplay } from './MatrixDisplay'

interface SliderDef {
  key: 'a' | 'b' | 'tx' | 'c' | 'd' | 'ty'
  label: string
  min: number
  max: number
  step: number
}

// Matrix index map: [a,b,tx, c,d,ty, g,h,w]
const MAT_SLIDERS: SliderDef[] = [
  { key: 'a', label: 'a', min: -3, max: 3, step: 0.05 },
  { key: 'b', label: 'b', min: -3, max: 3, step: 0.05 },
  { key: 'tx', label: 'tₓ', min: -5, max: 5, step: 0.05 },
  { key: 'c', label: 'c', min: -3, max: 3, step: 0.05 },
  { key: 'd', label: 'd', min: -3, max: 3, step: 0.05 },
  { key: 'ty', label: 't_y', min: -5, max: 5, step: 0.05 },
]

const MAT_IDX: Record<SliderDef['key'], number> = { a: 0, b: 1, tx: 2, c: 3, d: 4, ty: 5 }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-accent/80">{children}</p>
  )
}

export interface AffineSidebarProps {
  transformMatrix: Mat
  projectiveMode: boolean
  projectiveG: number
  projectiveH: number
  inversionMode: boolean
  inversionCX: number
  inversionCY: number
  inversionR: number
  onPreset: (mat: Mat) => void
  onMatrixCell: (idx: number, value: number) => void
  onToggleProjective: (on: boolean) => void
  onProjective: (which: 'g' | 'h', value: number) => void
  onToggleInversion: (on: boolean) => void
  onInversion: (which: 'cx' | 'cy' | 'r', value: number) => void
  onResetView: () => void
  onResetAll: () => void
}

export function AffineSidebar(props: AffineSidebarProps) {
  const {
    transformMatrix,
    projectiveMode,
    projectiveG,
    projectiveH,
    inversionMode,
    inversionCX,
    inversionCY,
    inversionR,
  } = props

  return (
    <div className="flex flex-col gap-5">
      {/* Presets */}
      <section>
        <SectionLabel>预设变换</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => props.onPreset([...p.mat])}
              className={cn(
                'rounded-md border border-border-soft bg-surface-2 px-2 py-1.5 text-xs text-fg-soft',
                'transition-colors hover:border-accent hover:bg-surface-3 hover:text-fg active:scale-[0.98]',
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      {/* Matrix sliders */}
      <section>
        <SectionLabel>矩阵参数</SectionLabel>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {MAT_SLIDERS.map((s) => {
            const idx = MAT_IDX[s.key]
            const val = transformMatrix[idx] ?? 0
            return (
              <Slider
                key={s.key}
                label={s.label}
                valueLabel={val.toFixed(2)}
                min={s.min}
                max={s.max}
                step={s.step}
                value={val}
                onChange={(e) => props.onMatrixCell(idx, parseFloat(e.target.value))}
              />
            )
          })}
        </div>
      </section>

      {/* Live matrix display */}
      <section>
        <SectionLabel>变换矩阵</SectionLabel>
        <div className="rounded-lg border border-border-soft bg-surface-2 px-2 py-2">
          <MatrixDisplay
            transformMatrix={transformMatrix}
            projectiveMode={projectiveMode}
            projectiveG={projectiveG}
            projectiveH={projectiveH}
          />
        </div>
      </section>

      {/* Projective toggle */}
      <section>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-soft">
          <input
            type="checkbox"
            checked={projectiveMode}
            onChange={(e) => props.onToggleProjective(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-surface-3 accent-[var(--color-accent)]"
          />
          射影变换 (g, h)
        </label>
        {projectiveMode && (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <Slider
              label="g"
              valueLabel={projectiveG.toFixed(2)}
              min={-1}
              max={1}
              step={0.01}
              value={projectiveG}
              onChange={(e) => props.onProjective('g', parseFloat(e.target.value))}
            />
            <Slider
              label="h"
              valueLabel={projectiveH.toFixed(2)}
              min={-1}
              max={1}
              step={0.01}
              value={projectiveH}
              onChange={(e) => props.onProjective('h', parseFloat(e.target.value))}
            />
          </div>
        )}
      </section>

      {/* Inversion toggle */}
      <section>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-soft">
          <input
            type="checkbox"
            checked={inversionMode}
            onChange={(e) => props.onToggleInversion(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-surface-3 accent-[var(--color-accent)]"
          />
          启用反演变换
        </label>
        {inversionMode && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="rounded-md bg-accent-soft px-2 py-1.5 text-[0.7rem] text-accent">
              OP × OP′ = R²　（圆心 → 无穷远）
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Slider
                label="cₓ"
                valueLabel={inversionCX.toFixed(2)}
                min={-5}
                max={5}
                step={0.05}
                value={inversionCX}
                onChange={(e) => props.onInversion('cx', parseFloat(e.target.value))}
              />
              <Slider
                label="c_y"
                valueLabel={inversionCY.toFixed(2)}
                min={-5}
                max={5}
                step={0.05}
                value={inversionCY}
                onChange={(e) => props.onInversion('cy', parseFloat(e.target.value))}
              />
              <Slider
                label="R"
                valueLabel={inversionR.toFixed(2)}
                min={0.2}
                max={6}
                step={0.05}
                value={inversionR}
                onChange={(e) => props.onInversion('r', parseFloat(e.target.value))}
              />
            </div>
          </div>
        )}
      </section>

      {/* Reset actions */}
      <section className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={props.onResetView}>
          重置视图
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={props.onResetAll}>
          全部重置
        </Button>
      </section>
    </div>
  )
}
