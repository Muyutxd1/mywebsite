import type { Pt } from './lib/inversionMath'

/** 当前工具。默认 invCenter（先放反演圆）。 */
export type Tool = 'select' | 'point' | 'segment' | 'line' | 'circle' | 'invCenter'

export interface PointObj {
  type: 'point'
  id: number
  x: number
  y: number
}

export interface SegmentObj {
  type: 'segment'
  id: number
  p1: Pt
  p2: Pt
}

/** 由两点确定的无穷直线。 */
export interface LineObj {
  type: 'line'
  id: number
  p1: Pt
  p2: Pt
}

export interface CircleObj {
  type: 'circle'
  id: number
  center: Pt
  radius: number
}

export type SceneObject = PointObj | SegmentObj | LineObj | CircleObj

/** 选中目标。 */
export type Selection =
  | { type: 'object'; objId: number; sub?: 'p1' | 'p2' | 'center' }
  | { type: 'invCenter' }
  | { type: 'invRadius' }
  | null

/** 两步构造中。 */
export type Constructing = { p1: Pt; tool: 'segment' | 'line' } | { center: Pt } | null

/** 拖拽手势。 */
export type Drag =
  | { type: 'pan'; sx: number; sy: number; scx: number; scy: number }
  | { type: 'resizeRadius' }
  | { type: 'moveInvCenter' }
  | { type: 'moveVertex'; objId: number; sub?: 'p1' | 'p2' | 'center' }
  | null

/** 选中对象的像信息（传给侧栏读出）。 */
export interface SelectionInfo {
  objLabel: string
  title: string
  lines: string[]
  special: boolean
}
