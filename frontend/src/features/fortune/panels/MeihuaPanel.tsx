import { useState } from 'react'
import { Button, Card, CardBody, Field, Input } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFortuneApi } from '../useFortuneApi'
import { HexagramDiagram } from '../components/HexagramDiagram'
import { ReadingRenderer } from '../components/ReadingRenderer'
import {
  Chip,
  GuaTag,
  Lead,
  FortuneLoading,
  fortuneVerdict,
  VERDICT_BORDER,
  VERDICT_TEXT,
  WUXING_TEXT,
} from '../components/shared'
import type { MeihuaResult } from '../types'

const rand = () => Math.floor(Math.random() * 99) + 1

export function MeihuaPanel() {
  const [n1, setN1] = useState('')
  const [n2, setN2] = useState('')
  const [n3, setN3] = useState('')
  const { data, loading, error, run } = useFortuneApi<MeihuaResult>('meihua')
  const [localError, setLocalError] = useState<string | null>(null)

  function submit(a: string, b: string, c: string) {
    if (!a || !b || !c) {
      setLocalError('请输入三个数字')
      return
    }
    setLocalError(null)
    void run({ n1: Number(a), n2: Number(b), n3: Number(c) })
  }

  function randomFill() {
    const a = String(rand())
    const b = String(rand())
    const c = String(rand())
    setN1(a)
    setN2(b)
    setN3(c)
    submit(a, b, c)
  }

  const shownError = localError ?? error

  return (
    <div>
      <Lead>
        梅花易数 · 以三个数字起卦：上卦数定上卦、下卦数定下卦、动爻数定动爻，再以体用生克断吉凶。
        随便想三个数，或让命运替你掷骰。
      </Lead>

      <Card>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit(n1, n2, n3)
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-3 gap-3">
              <Field label="上卦数">
                <Input type="number" min={1} max={99} value={n1} onChange={(e) => setN1(e.target.value)} placeholder="1–99" />
              </Field>
              <Field label="下卦数">
                <Input type="number" min={1} max={99} value={n2} onChange={(e) => setN2(e.target.value)} placeholder="1–99" />
              </Field>
              <Field label="动爻数">
                <Input type="number" min={1} max={99} value={n3} onChange={(e) => setN3(e.target.value)} placeholder="1–99" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="gold">起卦推演</Button>
              <Button type="button" variant="secondary" onClick={randomFill}>随机 🎲</Button>
            </div>
            {shownError && <p className="text-sm text-danger">{shownError}</p>}
          </form>
        </CardBody>
      </Card>

      <div className="mt-5">
        {loading ? (
          <FortuneLoading />
        ) : data ? (
          <MeihuaResultView data={data} />
        ) : null}
      </div>
    </div>
  )
}

function MeihuaResultView({ data: d }: { data: MeihuaResult }) {
  const verdict = fortuneVerdict(d.ti_yong_fortune)
  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Chip>上卦 {d.numbers[0]} → {d.upper_symbol}{d.upper_gua}</Chip>
          <Chip>下卦 {d.numbers[1]} → {d.lower_symbol}{d.lower_gua}</Chip>
          <Chip tone="gold">动爻 第 {d.changing_line} 爻</Chip>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
          <HexagramDiagram lines={d.ben_gua.lines} moving={[d.changing_line]} className="shrink-0 py-2" />
          <div className="grid w-full grid-cols-3 gap-2">
            <GuaTag gua={d.ben_gua} label="本卦" />
            <GuaTag gua={d.hu_gua} label="互卦" />
            <GuaTag gua={d.bian_gua} label="变卦" />
          </div>
        </div>

        <div className={cn('rounded-xl border px-4 py-3', VERDICT_BORDER[verdict])}>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-fg">{d.ti_yong_relation}</span>
            <span className={cn('text-sm font-bold', VERDICT_TEXT[verdict])}>· {d.ti_yong_fortune}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            体 {d.ti_gua}（<span className={WUXING_TEXT[d.ti_wuxing]}>{d.ti_wuxing}</span>） —
            用 {d.yong_gua}（<span className={WUXING_TEXT[d.yong_wuxing]}>{d.yong_wuxing}</span>）
          </p>
        </div>

        <ReadingRenderer text={d.interpretation} />
      </CardBody>
    </Card>
  )
}
