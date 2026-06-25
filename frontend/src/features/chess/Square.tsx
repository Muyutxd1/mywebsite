import { memo } from 'react'
import { PIECE_UNICODE } from './engine'
import { cn } from '@/lib/cn'
import type { Piece } from './types'

export interface SquareProps {
  index: number
  r: number
  c: number
  piece: Piece | null
  isLight: boolean
  isSelected: boolean
  isLegal: boolean
  isCapture: boolean
  isLastMove: boolean
  isCheck: boolean
  isHintFrom: boolean
  isHintTo: boolean
  onClick: (r: number, c: number) => void
}

function isWhitePiece(p: Piece): boolean {
  return p === p.toUpperCase()
}

function SquareImpl({
  r,
  c,
  piece,
  isLight,
  isSelected,
  isLegal,
  isCapture,
  isLastMove,
  isCheck,
  isHintFrom,
  isHintTo,
  onClick,
}: SquareProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(r, c)}
      aria-label={`square ${'abcdefgh'[c]}${8 - r}`}
      className={cn(
        'relative flex items-center justify-center select-none',
        'text-[clamp(22px,8.2vw,44px)] leading-none transition-colors duration-150',
        // base square colors — warm board palette scoped to this feature
        isLight ? 'bg-[#e9d7b8]' : 'bg-[#a9805f]',
        isLastMove && 'bg-gold/45',
      )}
    >
      {/* in-check radial glow under the king */}
      {isCheck && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(240,97,109,0.65) 0%, rgba(240,97,109,0.2) 60%, transparent 100%)',
          }}
        />
      )}

      {/* selected ring */}
      {isSelected && (
        <span aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_4px_rgba(231,180,85,0.85)]" />
      )}
      {/* hint rings (green) */}
      {isHintFrom && (
        <span aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_4px_rgba(70,209,138,0.85)]" />
      )}
      {isHintTo && (
        <span aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_4px_rgba(70,209,138,0.65)]" />
      )}

      {/* piece glyph */}
      {piece && (
        <span
          aria-hidden
          className="pointer-events-none relative z-10"
          style={
            isWhitePiece(piece)
              ? {
                  color: '#fafafa',
                  textShadow: '-1px -1px 0 #2a2a2a, 1px -1px 0 #2a2a2a, -1px 1px 0 #2a2a2a, 1px 1px 0 #2a2a2a',
                }
              : {
                  color: '#161616',
                  textShadow: '-1px -1px 0 #e8e8e8, 1px -1px 0 #e8e8e8, -1px 1px 0 #e8e8e8, 1px 1px 0 #e8e8e8',
                }
          }
        >
          {PIECE_UNICODE[piece]}
        </span>
      )}

      {/* legal-move indicator: dot for quiet, ring for capture */}
      {isLegal && !isCapture && (
        <span
          aria-hidden
          className="pointer-events-none absolute z-20 rounded-full bg-black/30"
          style={{ width: '32%', height: '32%' }}
        />
      )}
      {isLegal && isCapture && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[6%] z-20 rounded-full"
          style={{ border: '5px solid rgba(0,0,0,0.28)' }}
        />
      )}
    </button>
  )
}

export const Square = memo(SquareImpl)
