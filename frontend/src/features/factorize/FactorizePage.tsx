import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Card, CardBody, Spinner } from '@/components/ui'
import { apiPost } from '@/lib/api'
import { SectionHeader } from '@/components/home/SectionHeader'
import { ExampleChips } from './components/ExampleChips'
import { ResultCard } from './components/ResultCard'
import type { FactorizeResponse } from './types'

export default function FactorizePage() {
  const [expression, setExpression] = useState('')

  const mutation = useMutation<FactorizeResponse, Error, string>({
    mutationFn: (expr: string) =>
      apiPost<FactorizeResponse>('/api/factorize', { expression: expr }),
  })

  const submit = (raw?: string) => {
    // Empty/invalid input is intentionally still sent: backend returns 200
    // with an `error` field ('请输入表达式') which we surface verbatim.
    const expr = (raw ?? expression).trim()
    setExpression(expr)
    mutation.mutate(expr)
  }

  const pickExample = (expr: string) => {
    setExpression(expr)
    submit(expr)
  }

  const data = mutation.data
  // Empty/invalid input returns HTTP 200 with an `error` field.
  const apiError = data?.error
  // Network / non-200 errors surface via mutation.error.
  const networkError = mutation.isError ? mutation.error?.message || '网络错误，请重试' : undefined
  const errorMsg = networkError || apiError
  const hasResult = !!data && !data.error

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
      <SectionHeader
        label="工具 · 代数"
        title="因式分解"
        description="输入一个多项式，自动给出因式分解结果与分步推导。"
      />

      <Card>
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <input
              type="text"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="输入多项式，如 x^2 - 5x + 6"
              className="flex-1 rounded-lg border border-border-soft bg-surface-2 px-4 py-3 font-mono text-lg text-fg outline-none transition-colors placeholder:font-sans placeholder:text-base placeholder:text-faint focus:border-accent focus:bg-surface-3"
            />
            <Button
              size="lg"
              onClick={() => submit()}
              disabled={mutation.isPending}
              className="sm:w-auto"
            >
              {mutation.isPending ? (
                <>
                  <Spinner size={18} />
                  计算中…
                </>
              ) : (
                '因式分解'
              )}
            </Button>
          </div>

          <ExampleChips onPick={pickExample} />
        </CardBody>
      </Card>

      {errorMsg && (
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3.5 text-center font-medium text-danger">
          {errorMsg}
        </div>
      )}

      {hasResult && <ResultCard data={data} />}
    </div>
  )
}
