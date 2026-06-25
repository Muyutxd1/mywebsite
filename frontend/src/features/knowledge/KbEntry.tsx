import { MathBlock, MathText } from '@/lib/math'
import { TagPill } from './TagPill'
import type { KbEntry as KbEntryType } from './types'

/**
 * A single knowledge-base entry.
 *
 * `visible` gates KaTeX work: when the parent chapter is collapsed we render
 * only plain (escaped) text so we never pay for hundreds of formulas up front.
 * `preLine` preserves the literal `\n` line breaks used by the number-theory
 * "学习路径指引" entry.
 */
export function KbEntry({
  entry,
  visible,
  preLine,
}: {
  entry: KbEntryType
  visible: boolean
  preLine?: boolean
}) {
  const tags = entry.tags ?? []
  const hasBody = Boolean(entry.formula || entry.statement || entry.detail)

  return (
    <div className="border-b border-border-soft py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="min-w-[1.75rem] font-mono text-[11px] text-faint">#{entry.id}</span>
        <span className="text-sm font-bold text-fg sm:text-[15px]">{entry.title}</span>
        {tags.length > 0 && (
          <span className="ml-auto flex flex-wrap gap-1">
            {tags.map((t, i) => (
              <TagPill key={i} tag={t} />
            ))}
          </span>
        )}
      </div>

      {hasBody && (
        <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-fg-soft sm:text-sm">
          {entry.formula &&
            (visible ? (
              <MathBlock
                tex={entry.formula}
                className="overflow-x-auto rounded-lg border-l-[3px] border-accent bg-surface-2 px-4 py-2.5"
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border-l-[3px] border-accent bg-surface-2 px-4 py-2.5 font-mono text-xs text-muted">
                {entry.formula}
              </div>
            ))}

          {entry.statement &&
            (visible ? (
              <p>
                <MathText>{entry.statement}</MathText>
              </p>
            ) : (
              <p>{entry.statement}</p>
            ))}

          {entry.detail &&
            (visible ? (
              <p className={preLine ? 'whitespace-pre-line text-muted' : 'text-muted'}>
                <MathText>{entry.detail}</MathText>
              </p>
            ) : (
              <p className={preLine ? 'whitespace-pre-line text-muted' : 'text-muted'}>
                {entry.detail}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}
