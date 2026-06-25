import { useState } from 'react'
import { Button, Card, CardBody } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFortuneApi } from '../useFortuneApi'
import { HexagramDiagram } from '../components/HexagramDiagram'
import { ReadingRenderer } from '../components/ReadingRenderer'
import { Chip, GuaTag, Lead, FortuneLoading } from '../components/shared'
import type { YijingResult } from '../types'

// heads-count → line name (legacy: 3=老阳, 2=少阴, 1=少阳, 0=老阴)
const TOSS_NAME: Record<number, string> = { 3: '老阳', 2: '少阴', 1: '少阳', 0: '老阴' }
const COIN_OPTIONS = [
  { heads: 3, label: '三正 · 老阳' },
  { heads: 2, label: '两正 · 少阴' },
  { heads: 1, label: '一正 · 少阳' },
  { heads: 0, label: '三反 · 老阴' },
]

export function YijingPanel() {
  const { data, loading, error, run, reset } = useFortuneApi<YijingResult>('yijing')
  const [manual, setManual] = useState(false)
  const [tosses, setTosses] = useState<number[]>([])

  function autoCast() {
    setManual(false)
    setTosses([])
    void run({ manual_lines: null })
  }

  function startManual() {
    reset()
    setManual(true)
    setTosses([])
  }

  function toss(heads: number) {
    const next = [...tosses, heads]
    setTosses(next)
    if (next.length === 6) {
      setManual(false)
      void run({ manual_lines: next })
    }
  }

  return (
    <div>
      <Lead>
        易经铜钱起卦 · 诚心默念所问之事，掷六次铜钱自下而上成卦。本卦为现状，变卦为趋向，动爻是关键指引。
      </Lead>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="gold" onClick={autoCast}>自动起卦</Button>
            <Button variant="secondary" onClick={startManual}>手动掷卦</Button>
          </div>

          {manual && (
            <div className="space-y-3 rounded-xl border border-border-soft bg-surface-2 p-4">
              <p className="text-sm font-medium text-fg">
                第 <span className="text-gold">{Math.min(tosses.length + 1, 6)}</span> / 6 掷
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {COIN_OPTIONS.map((o) => (
                  <Button key={o.heads} size="sm" variant="outline" onClick={() => toss(o.heads)}>
                    {o.label}
                  </Button>
                ))}
              </div>
              {tosses.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {tosses.map((h, i) => (
                    <Chip key={i}>
                      {i + 1}·{TOSS_NAME[h]}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
        </CardBody>
      </Card>

      <div className="mt-5">
        {loading ? <FortuneLoading /> : data ? <YijingResultView data={data} /> : null}
      </div>
    </div>
  )
}

function YijingResultView({ data: d }: { data: YijingResult }) {
  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
          <HexagramDiagram lines={d.ben_gua.lines} moving={d.moving_positions} className="shrink-0 py-2" />
          <div className={cn('grid w-full gap-2', d.bian_gua ? 'grid-cols-2' : 'grid-cols-1')}>
            <GuaTag gua={d.ben_gua} label="本卦" />
            {d.bian_gua && <GuaTag gua={d.bian_gua} label="变卦" />}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {d.has_changes ? (
            <Chip tone="gold">动爻 第 {d.moving_positions.join('、')} 爻</Chip>
          ) : (
            <Chip>六爻安静</Chip>
          )}
        </div>

        <ReadingRenderer text={d.interpretation} />
      </CardBody>
    </Card>
  )
}
