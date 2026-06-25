import { useState } from 'react'
import { Button, Card, CardBody, Field, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFortuneApi } from '../useFortuneApi'
import { ReadingRenderer } from '../components/ReadingRenderer'
import { Chip, Lead, FortuneLoading } from '../components/shared'
import type { TarotResult, TarotCard, TarotSpread } from '../types'

const SPREADS: { value: TarotSpread; label: string }[] = [
  { value: 'single', label: '单张牌 · 每日指引' },
  { value: 'three', label: '三张牌 · 过去现在未来' },
  { value: 'celtic_cross', label: '凯尔特十字 · 全面解读' },
]

export function TarotPanel() {
  const [spread, setSpread] = useState<TarotSpread>('three')
  const { data, loading, error, run } = useFortuneApi<TarotResult>('tarot')

  return (
    <div>
      <Lead>
        塔罗牌 · 洗牌、抽牌、正逆，牌面是内在智慧的镜子，不是命运的铁律。选一种牌阵，默想你的问题。
      </Lead>

      <Card>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run({ spread })
            }}
            className="space-y-4"
          >
            <Field label="牌阵">
              <Select value={spread} onChange={(e) => setSpread(e.target.value as TarotSpread)}>
                {SPREADS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="gold">抽牌占卜</Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </form>
        </CardBody>
      </Card>

      <div className="mt-5">
        {loading ? <FortuneLoading /> : data ? <TarotResultView data={data} /> : null}
      </div>
    </div>
  )
}

function TarotResultView({ data: d }: { data: TarotResult }) {
  return (
    <Card>
      <CardBody className="space-y-5">
        <p className="text-sm font-medium text-gold">{d.spread_name}</p>
        <div className="space-y-3">
          {d.cards.map((c) => (
            <TarotCardView key={c.position_index} card={c} />
          ))}
        </div>
        <ReadingRenderer text={d.interpretation} />
      </CardBody>
    </Card>
  )
}

function TarotCardView({ card: c }: { card: TarotCard }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        c.is_upright ? 'border-gold/30 bg-gold/6' : 'border-rose/30 bg-rose/6',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip>{c.position}</Chip>
        <span className="font-semibold text-fg">{c.name_cn}</span>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs font-medium',
            c.is_upright ? 'border-gold/35 text-gold' : 'border-rose/35 text-rose',
          )}
        >
          {c.orientation}
        </span>
      </div>
      <p className="mt-1 text-xs text-faint">{c.type} · {c.name_en}</p>
      {c.keywords.length > 0 && (
        <p className="mt-1 text-xs text-muted">{c.keywords.join(' · ')}</p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-fg-soft">{c.interpretation}</p>
    </div>
  )
}
