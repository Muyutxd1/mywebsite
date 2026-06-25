import { useState } from 'react'
import { Button, Card, CardBody, Field, Input } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFortuneApi } from '../useFortuneApi'
import { ReadingRenderer } from '../components/ReadingRenderer'
import { Lead, FortuneLoading, WuxingBars, WUXING_TEXT } from '../components/shared'
import type { BaziResult, BaziPillar } from '../types'

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const
const PILLAR_LABELS: Record<(typeof PILLAR_KEYS)[number], string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
}

export function BaziPanel() {
  const [year, setYear] = useState('2000')
  const [month, setMonth] = useState('1')
  const [day, setDay] = useState('1')
  const [hour, setHour] = useState('0')
  const { data, loading, error, run } = useFortuneApi<BaziResult>('bazi')

  return (
    <div>
      <Lead>
        八字排盘 · 以出生年月日时排出四柱干支，析五行旺衰、十神格局与日主喜忌。日主即「你」，是整盘的核心。
      </Lead>

      <Card>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run({ year: Number(year), month: Number(month), day: Number(day), hour: Number(hour), minute: 0 })
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="年"><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
              <Field label="月"><Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
              <Field label="日"><Input type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
              <Field label="时 (0–23)"><Input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(e.target.value)} /></Field>
            </div>
            <Button type="submit" variant="gold">排盘推演</Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </form>
        </CardBody>
      </Card>

      <div className="mt-5">
        {loading ? <FortuneLoading /> : data ? <BaziResultView data={data} /> : null}
      </div>
    </div>
  )
}

function BaziResultView({ data: d }: { data: BaziResult }) {
  const row = (label: string, render: (p: BaziPillar) => React.ReactNode) => (
    <tr className="border-t border-border-soft">
      <td className="py-2 pr-3 text-xs font-medium text-muted">{label}</td>
      {PILLAR_KEYS.map((k) => (
        <td key={k} className="px-2 py-2 text-center text-fg-soft">{render(d.pillars[k])}</td>
      ))}
    </tr>
  )

  return (
    <Card>
      <CardBody className="space-y-6">
        {/* 日主 card */}
        <div className="flex items-center justify-between rounded-xl border border-border-soft bg-surface-2 px-4 py-3">
          <span className="text-xs uppercase tracking-widest text-faint">日主 · 你</span>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-2xl font-bold', WUXING_TEXT[d.day_master_wuxing])}>{d.day_master}</span>
            <span className={cn('text-sm', WUXING_TEXT[d.day_master_wuxing])}>{d.day_master_wuxing}命</span>
          </div>
        </div>

        {/* 四柱 table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr>
                <th className="w-12" />
                {PILLAR_KEYS.map((k) => (
                  <th key={k} className="px-2 pb-2 text-center text-xs font-semibold text-gold">{PILLAR_LABELS[k]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {row('干支', (p) => <span className="text-base font-bold text-fg">{p.full}</span>)}
              {row('五行', (p) => (
                <span className="text-xs">
                  <span className={WUXING_TEXT[p.gan_wuxing]}>{p.gan_wuxing}</span>{' '}
                  <span className={WUXING_TEXT[p.zhi_wuxing]}>{p.zhi_wuxing}</span>
                </span>
              ))}
              {row('藏干', (p) => <span className="text-xs text-muted">{(p.zhi_canggan || []).join(' ')}</span>)}
              {row('十神', (p) => <span className="text-xs">{p.shishen}</span>)}
              {row('纳音', (p) => <span className="text-xs text-muted">{p.nayin}</span>)}
            </tbody>
          </table>
        </div>

        {/* 五行分布 bars */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-gold">五行分布</h4>
          <WuxingBars counts={d.wuxing_count} />
        </div>

        <ReadingRenderer text={d.interpretation} />
      </CardBody>
    </Card>
  )
}
