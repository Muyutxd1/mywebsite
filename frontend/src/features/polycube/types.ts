/**
 * Local types for the Polycube studio.
 *
 * This feature is pure-frontend (no backend endpoint) — all state lives in
 * localStorage. Engine domain types are re-exported from the pure engine so
 * components import from a single place.
 */
export type { Cell, Mat3, Piece, Placement, BoardState } from './lib/polycubeEngine'

/** A piece currently selected for placement, with its live rotation index. */
export interface ActiveSelection {
  pieceId: string
  rotIdx: number
}

/** A board cell the pointer is currently hovering over the Y=0 floor / a face. */
export interface HoveredCell {
  x: number
  y: number
  z: number
}
