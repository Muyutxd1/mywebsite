import type { BadgeTone } from '@/components/ui'

/** Map a problem's difficulty key to a Badge tone on the verdict-ish ramp. */
export function difficultyTone(difficulty: string): BadgeTone {
  switch ((difficulty || '').toLowerCase()) {
    case 'easy':
      return 'success'
    case 'hard':
    case 'expert':
      return 'danger'
    case 'medium':
    default:
      return 'warning'
  }
}
