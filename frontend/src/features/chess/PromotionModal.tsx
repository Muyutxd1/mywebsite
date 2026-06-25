import { Modal } from '@/components/ui'
import { PIECE_UNICODE } from './engine'
import type { Color, Piece } from './types'

const CHOICES: ('Q' | 'R' | 'B' | 'N')[] = ['Q', 'R', 'B', 'N']

export function PromotionModal({
  open,
  color,
  onSelect,
  onCancel,
}: {
  open: boolean
  color: Color
  onSelect: (p: 'Q' | 'R' | 'B' | 'N') => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title="选择升变棋子">
      <div className="flex justify-center gap-3">
        {CHOICES.map((p) => {
          const glyph = (color === 'w' ? p : (p.toLowerCase() as string)) as Piece
          const isWhite = color === 'w'
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelect(p)}
              className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-transparent bg-[#e9d7b8] text-4xl transition-colors hover:border-accent"
              style={
                isWhite
                  ? { color: '#fafafa', textShadow: '-1px -1px 0 #2a2a2a, 1px -1px 0 #2a2a2a, -1px 1px 0 #2a2a2a, 1px 1px 0 #2a2a2a' }
                  : { color: '#161616', textShadow: '-1px -1px 0 #e8e8e8, 1px -1px 0 #e8e8e8, -1px 1px 0 #e8e8e8, 1px 1px 0 #e8e8e8' }
              }
            >
              {PIECE_UNICODE[glyph]}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
