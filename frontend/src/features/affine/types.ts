/**
 * Local types for the 仿射变换 (affine/projective) visualizer.
 * Pure-frontend feature — no backend API.
 */
import type { Mat, View } from './lib/affineMath'

export type Side = 'left' | 'right'

export interface DragState {
  side: Side
  idx: number
}

export interface PanState {
  side: Side
  startClientX: number
  startClientY: number
  startCx: number
  startCy: number
}

export interface HoverState {
  side: Side
  idx: number
}

/** The full controllable state of the visualizer (lives in refs for hot-path). */
export interface AffineState {
  transformMatrix: Mat
  projectiveMode: boolean
  projectiveG: number
  projectiveH: number
  inversionMode: boolean
  inversionCX: number
  inversionCY: number
  inversionR: number
  viewLeft: View
  viewRight: View
}
