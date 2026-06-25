import { Badge, Card, CardBody } from '@/components/ui'
import { LikertOptions } from './LikertOptions'
import type { MbtiDimension, MbtiOption, MbtiQuestion } from './types'

/** Maps a dimension key to its bipolar tag, e.g. EI → "外向 ↔ 内向". */
function dimTag(dim: MbtiDimension): string {
  const left = dim.leftLabel.replace(/\s*[A-Z]\s*$/, '').trim()
  const right = dim.rightLabel.replace(/\s*[A-Z]\s*$/, '').trim()
  return `${left} ↔ ${right}`
}

/** One question: index + dimension tag, the prompt, and the 5 Likert options. */
export function QuestionCard({
  question,
  dimension,
  index,
  options,
  optionEmoji,
  selected,
  onSelect,
}: {
  question: MbtiQuestion
  dimension: MbtiDimension | undefined
  index: number
  options: MbtiOption[]
  optionEmoji: string[]
  selected: number | undefined
  onSelect: (value: number) => void
}) {
  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted">第 {index + 1} 题</span>
          {dimension && (
            <Badge tone="accent">{dimTag(dimension)}</Badge>
          )}
        </div>
        <p className="text-lg font-semibold leading-relaxed text-fg sm:text-xl">{question.text}</p>
        <LikertOptions
          options={options}
          optionEmoji={optionEmoji}
          selected={selected}
          onSelect={onSelect}
        />
      </CardBody>
    </Card>
  )
}
