// Re-export the engine data model so feature components share one source of truth.
// (Pure-frontend feature — no API response types.)
export type {
  Coord,
  Piece,
  Placement,
  BoardState,
  ActiveSelection,
  OccupiedCell,
} from './lib/polyominoMath'

export interface HoverCell {
  r: number
  c: number
}
