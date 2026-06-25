import type { ReactNode } from 'react'
import { Button, Card, CardBody } from '@/components/ui'
import { DimensionBars } from './DimensionBars'
import type { MbtiResult, MbtiTypeInfo } from './types'

/** A small titled section card used across the result screen. */
function SectionCard({
  icon,
  title,
  titleClassName,
  children,
}: {
  icon: string
  title: string
  titleClassName?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <h3 className={`flex items-center gap-2 text-base font-bold ${titleClassName ?? 'text-accent'}`}>
          <span aria-hidden>{icon}</span>
          {title}
        </h3>
        {children}
      </CardBody>
    </Card>
  )
}

export function ResultView({
  result,
  typeInfo,
  typeName,
  typeEmoji,
  onRestart,
}: {
  result: MbtiResult
  typeInfo: MbtiTypeInfo | null
  typeName: string
  typeEmoji: string
  onRestart: () => void
}) {
  const { typeCode, dimResults } = result

  return (
    <div className="space-y-5">
      {/* Type header */}
      <div className="text-center">
        <div className="text-5xl sm:text-6xl" aria-hidden>
          {typeEmoji}
        </div>
        <div className="mt-2 text-4xl font-extrabold tracking-[0.3em] text-cosmic sm:text-5xl">
          {typeCode}
        </div>
        {typeName && <div className="mt-1 text-lg text-fg-soft">{typeName}</div>}
      </div>

      {/* Dimension analysis */}
      <SectionCard icon="📊" title="维度分析" titleClassName="text-fg">
        <DimensionBars results={dimResults} />
      </SectionCard>

      {typeInfo && (
        <>
          <SectionCard icon="✨" title="概述">
            <p className="leading-loose text-fg-soft">{typeInfo.summary}</p>
          </SectionCard>

          <div className="grid gap-5 sm:grid-cols-2">
            <SectionCard icon="💪" title="优势" titleClassName="text-success">
              <ul className="space-y-1.5 text-fg-soft">
                {typeInfo.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed">
                    <span className="mt-1 text-success" aria-hidden>
                      ·
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard icon="⚠️" title="需注意" titleClassName="text-warning">
              <ul className="space-y-1.5 text-fg-soft">
                {typeInfo.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed">
                    <span className="mt-1 text-warning" aria-hidden>
                      ·
                    </span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <SectionCard icon="💼" title="适合职业">
              <p className="leading-loose text-fg-soft">{typeInfo.careers.join('、')}</p>
            </SectionCard>
            <SectionCard icon="❤️" title="感情特征">
              <p className="leading-loose text-fg-soft">{typeInfo.relationships}</p>
            </SectionCard>
          </div>

          <SectionCard icon="🌟" title="知名人物" titleClassName="text-gold">
            <p className="leading-loose text-fg-soft">{typeInfo.famous.join('、')}</p>
          </SectionCard>
        </>
      )}

      <div className="pt-2 text-center">
        <Button size="lg" onClick={onRestart}>
          🔄 重新测试
        </Button>
      </div>
    </div>
  )
}
