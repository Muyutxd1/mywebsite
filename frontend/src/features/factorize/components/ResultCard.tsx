import { Card, CardBody } from '@/components/ui'
import { MathBlock, MathText } from '@/lib/math'
import type { FactorizeResponse } from '../types'

/**
 * Renders the factorization result + numbered steps.
 *
 * Result display branch (preserved from legacy):
 *  - is_constant            -> show factored_unicode/factored as PLAIN text
 *  - factored_unicode meaningfully differs from factored -> plain text
 *  - otherwise              -> KaTeX-render the LaTeX via MathBlock
 *
 * Each step string embeds inline $...$ fragments -> render with <MathText>.
 */
export function ResultCard({ data }: { data: FactorizeResponse }) {
  const factored = data.factored ?? ''
  const unicode = data.factored_unicode ?? ''

  const usePlainText =
    data.is_constant === true || (unicode.length > 0 && unicode !== factored)

  const display = unicode || factored
  const steps = data.steps ?? []

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardBody>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-accent/80">
            分解结果
          </p>
          <div className="flex min-h-[3rem] items-center justify-center overflow-x-auto px-2 py-2 text-2xl text-fg sm:text-[1.75rem]">
            {usePlainText ? (
              <span className="font-mono text-fg">{display}</span>
            ) : (
              <MathBlock tex={factored} className="text-fg [&_.katex]:text-[1.15em]" />
            )}
          </div>
        </CardBody>
      </Card>

      {steps.length > 0 && (
        <Card>
          <CardBody>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-accent/80">
              分解步骤
            </p>
            <ol className="space-y-1">
              {steps.map((step, i) => {
                const isLast = i === steps.length - 1
                return (
                  <li
                    key={i}
                    className={
                      'flex items-start gap-3 border-b border-border-soft py-2.5 leading-relaxed last:border-b-0 ' +
                      (isLast ? 'font-semibold text-accent' : 'text-fg-soft')
                    }
                  >
                    <span
                      className={
                        'mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
                        (isLast
                          ? 'bg-accent text-accent-fg'
                          : 'bg-accent/15 text-accent')
                      }
                    >
                      {i + 1}
                    </span>
                    <MathText className="min-w-0 break-words">{step}</MathText>
                  </li>
                )
              })}
            </ol>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
