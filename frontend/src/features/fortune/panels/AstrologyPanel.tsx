import { useState } from 'react'
import { Button, Card, CardBody, Field, Input } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFortuneApi } from '../useFortuneApi'
import { ReadingRenderer } from '../components/ReadingRenderer'
import { Chip, Lead, FortuneLoading, ELEM_TEXT, ELEM_BORDER } from '../components/shared'
import type { AstrologyResult } from '../types'

const ELEM_ORDER = ['火', '土', '风', '水'] as const

export function AstrologyPanel() {
  const [f, setF] = useState({
    year: '2000', month: '1', day: '1', hour: '12', minute: '0',
    lat: '39.9', lng: '116.4', tz: '8',
  })
  const { data, loading, error, run } = useFortuneApi<AstrologyResult>('astrology')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      <Lead>
        西洋占星 · 以出生时刻与经纬度排本命盘，算行星落座、落宫与相位。太阳是「我是谁」、月亮是「我需要什么」、上升是「世界如何看我」。
      </Lead>

      <Card>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run({
                year: Number(f.year), month: Number(f.month), day: Number(f.day),
                hour: Number(f.hour), minute: Number(f.minute),
                lat: Number(f.lat), lng: Number(f.lng), tz: Number(f.tz),
              })
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="年"><Input type="number" value={f.year} onChange={set('year')} /></Field>
              <Field label="月"><Input type="number" min={1} max={12} value={f.month} onChange={set('month')} /></Field>
              <Field label="日"><Input type="number" min={1} max={31} value={f.day} onChange={set('day')} /></Field>
              <Field label="时"><Input type="number" min={0} max={23} value={f.hour} onChange={set('hour')} /></Field>
              <Field label="分"><Input type="number" min={0} max={59} value={f.minute} onChange={set('minute')} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="纬度" hint="北纬为正"><Input type="number" step="0.1" value={f.lat} onChange={set('lat')} /></Field>
              <Field label="经度" hint="东经为正"><Input type="number" step="0.1" value={f.lng} onChange={set('lng')} /></Field>
              <Field label="时区" hint="东八区 = 8"><Input type="number" value={f.tz} onChange={set('tz')} /></Field>
            </div>
            <Button type="submit" variant="gold">排盘推演</Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </form>
        </CardBody>
      </Card>

      <div className="mt-5">
        {loading ? <FortuneLoading /> : data ? <AstrologyResultView data={data} /> : null}
      </div>
    </div>
  )
}

function AstrologyResultView({ data: d }: { data: AstrologyResult }) {
  const sun = d.planets.find((p) => p.name === '太阳')
  const moon = d.planets.find((p) => p.name === '月亮')

  return (
    <Card>
      <CardBody className="space-y-6">
        {/* Big Three */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <BigThree glyph="☀" label="太阳" sign={sun?.sign} sub="核心自我" />
          <BigThree glyph="☽" label="月亮" sign={moon?.sign} sub="情感内心" />
          <BigThree glyph="↑" label="上升" sign={d.ascendant.sign} sub="外在形象" />
        </div>

        {/* 行星 table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-xs font-semibold text-gold">
                <th className="px-2 pb-2 text-left">行星</th>
                <th className="px-2 pb-2 text-left">星座</th>
                <th className="px-2 pb-2 text-left">宫位</th>
                <th className="px-2 pb-2 text-right">黄经</th>
              </tr>
            </thead>
            <tbody>
              {d.planets.map((p) => (
                <tr key={p.name} className="border-t border-border-soft">
                  <td className="px-2 py-2 font-medium text-fg">{p.name}</td>
                  <td className="px-2 py-2 text-fg-soft">{p.sign}座</td>
                  <td className="px-2 py-2 text-muted">第{p.house}宫</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted">{p.longitude}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 元素分布 */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gold">元素分布</h4>
          <div className="flex flex-wrap gap-2">
            {ELEM_ORDER.map((el) => (
              <span
                key={el}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                  ELEM_BORDER[el],
                  ELEM_TEXT[el],
                )}
              >
                {el}象 {d.element_count[el] ?? 0}
              </span>
            ))}
            <Chip tone="gold">主导 {d.dominant_sign}座</Chip>
          </div>
        </div>

        {/* 相位 */}
        {d.aspects && d.aspects.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gold">主要相位</h4>
            <div className="flex flex-wrap gap-2">
              {d.aspects.slice(0, 12).map((a, i) => (
                <Chip key={i}>
                  {a.p1} {a.symbol} {a.p2}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <ReadingRenderer text={d.interpretation} />
      </CardBody>
    </Card>
  )
}

function BigThree({ glyph, label, sign, sub }: { glyph: string; label: string; sign?: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gold/25 bg-gold/6 px-4 py-3">
      <span className="text-2xl text-gold">{glyph}</span>
      <div>
        <p className="text-xs text-faint">{label} · {sub}</p>
        <p className="text-base font-bold text-fg">{sign ?? '—'}座</p>
      </div>
    </div>
  )
}
