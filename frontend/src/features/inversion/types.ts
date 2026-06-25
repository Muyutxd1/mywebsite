import type { Pt } from './lib/inversionMath'

/** Active tool. Default active = invCenter (matches legacy). */
export type Tool = 'select' | 'point' | 'segment' | 'circle' | 'invCenter'

export interface PointObj {
  type: 'point'
  id: number
  x: number
  y: number
  label: string
}

export interface SegmentObj {
  type: 'segment'
  id: number
  p1: Pt
  p2: Pt
  label1: string
  label2: string
}

export interface CircleObj {
  type: 'circle'
  id: number
  center: Pt
  radius: number
}

export type SceneObject = PointObj | SegmentObj | CircleObj

/** Current selection target. */
export type Selection =
  | { type: 'object'; objId: number; sub?: 'p1' | 'p2' | 'center' }
  | { type: 'invCenter' }
  | { type: 'invRadius' }
  | null

/** In-progress two-click construction. */
export type Constructing = { p1: Pt } | { center: Pt } | null

/** Active drag gesture. */
export type Drag =
  | { type: 'pan'; sx: number; sy: number; scx: number; scy: number }
  | { type: 'resizeRadius' }
  | { type: 'moveInvCenter' }
  | { type: 'moveVertex'; objId: number; sub?: 'p1' | 'p2' | 'center' }
  | null
