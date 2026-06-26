import { Badge } from '@/components/ui'
import { difficultyLabel, difficultyTone } from '../data/labels'

/** Difficulty pill; renders a subtle 未评级 chip when not yet enriched. */
export function DifficultyBadge({
  difficulty,
  difficultyZh,
}: {
  difficulty: string | null | undefined
  difficultyZh?: string | null
}) {
  if (!difficulty) {
    return (
      <Badge tone="neutral" className="opacity-70">
        未评级
      </Badge>
    )
  }
  return <Badge tone={difficultyTone(difficulty)}>{difficultyLabel(difficulty, difficultyZh)}</Badge>
}
