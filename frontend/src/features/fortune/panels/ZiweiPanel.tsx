import { useState } from 'react'
import { Button, Card, CardBody, Field, Input, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFortuneApi } from '../useFortuneApi'
import { ReadingRenderer } from '../components/ReadingRenderer'
import { Chip, Lead, FortuneLoading } from '../components/shared'
import type { ZiweiResult, ZiweiPalace } from '../types'

const HUA_TONE: Record<string, string> = {
  禄: 'gold',
  权: 'accent',
  科: 'cyan',
  忌: 'neutral',
}

export function ZiweiPanel() {
  const [year, setYear] = useState('2000')
  const [month, setMonth] = useState('1')
  const [day, setDay] = useState('1')
  const [hour, setHour] = useState('0')
  const [gender, setGender] = useState('male')
  const { data, loading, error, run } = useFortuneApi<ZiweiResult>('ziwei')

  return (
    <div>
      <Lead>
        紫微斗数 · 安命宫、布十二宫、落十四主星与四化，照见性格底色、人生格局与各领域消长。
      </Lead>

      <Card>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run({ year: Number(year), month: Number(month), day: Number(day), hour: Number(hour), minute: 0, gender })
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="年"><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
              <Field label="月"><Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
              <Field label="日"><Input type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
              <Field label="时 (0–23)"><Input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(e.target.value)} /></Field>
            </div>
            <Field label="性别" className="max-w-[160px]">
              <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="male">男</option>
                <option value="female">女</option>
              </Select>
            </Field>
            <Button type="submit" variant="gold">排盘推演</Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </form>
        </CardBody>
      </Card>

      <div className="mt-5">
        {loading ? <FortuneLoading /> : data ? <ZiweiResultView data={data} /> : null}
      </div>
    </div>
  )
}

function ZiweiResultView({ data: d }: { data: ZiweiResult }) {
  const b = d.birth_info
  return (
    <Card>
      <CardBody className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Chip>{b.year_gan}{b.year_zhi}年</Chip>
          <Chip>{b.month_zhi}月</Chip>
          <Chip>{b.day_gan}{b.day_zhi}日</Chip>
          <Chip>{b.hour_zhi}时</Chip>
          <Chip tone="gold">命宫 {d.ming_palace}</Chip>
          <Chip tone="accent">身宫 {d.shen_palace}</Chip>
        </div>

        {/* 十二宫 grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {d.palaces.map((p) => (
            <PalaceCell key={p.name} palace={p} />
          ))}
        </div>

        {/* 四化 chips */}
        {d.sihua && Object.keys(d.sihua).length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gold">四化飞星</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(d.sihua).map(([star, hua]) => (
                <Chip key={star} tone={(HUA_TONE[hua] ?? 'neutral') as 'gold' | 'accent' | 'cyan' | 'neutral'}>
                  {star} 化{hua}
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

function PalaceCell({ palace: p }: { palace: ZiweiPalace }) {
  const highlight = p.is_ming
    ? 'border-gold/45 bg-gold/8'
    : p.is_shen
      ? 'border-accent/40 bg-accent/8'
      : 'border-border-soft bg-surface-2'
  return (
    <div className={cn('flex min-h-[78px] flex-col gap-1 rounded-lg border px-3 py-2', highlight)}>
      <span className="flex items-center gap-1 text-xs font-semibold text-fg">
        {p.name}
        {p.is_ming && <span className="text-[10px] text-gold">· 命</span>}
        {p.is_shen && <span className="text-[10px] text-accent">· 身</span>}
      </span>
      <span className="text-xs leading-relaxed text-muted">
        {p.stars.length ? p.stars.join(' ') : '—'}
      </span>
    </div>
  )
}
