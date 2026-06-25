import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, ErrorState, PageLoader } from '@/components/ui'
import { apiGet } from '@/lib/api'
import { ProgressBar } from './ProgressBar'
import { QuestionCard } from './QuestionCard'
import { ResultView } from './ResultView'
import { shuffle, useMbtiScore } from './useMbtiScore'
import type { MbtiQuestion, QuestionsResponse, TypesResponse } from './types'

export default function MbtiPage() {
  const questionsQuery = useQuery({
    queryKey: ['mbti', 'questions'],
    queryFn: () => apiGet<QuestionsResponse>('/api/mbti/questions'),
    staleTime: Infinity,
  })
  const typesQuery = useQuery({
    queryKey: ['mbti', 'types'],
    queryFn: () => apiGet<TypesResponse>('/api/mbti/types'),
    staleTime: Infinity,
  })

  if (questionsQuery.isLoading || typesQuery.isLoading) {
    return (
      <Shell>
        <PageLoader label="正在准备测试…" />
      </Shell>
    )
  }

  if (questionsQuery.isError || typesQuery.isError || !questionsQuery.data || !typesQuery.data) {
    return (
      <Shell>
        <ErrorState
          title="加载数据失败"
          description="请刷新页面重试。"
          onRetry={() => {
            void questionsQuery.refetch()
            void typesQuery.refetch()
          }}
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <MbtiTest questions={questionsQuery.data} types={typesQuery.data} />
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">
          Personality · 性格测试
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">MBTI 性格测试</h1>
        <p className="mt-2 text-muted">48 道题，凭直觉作答，揭开你的人格类型。</p>
      </header>
      {children}
    </div>
  )
}

function MbtiTest({ questions: data, types }: { questions: QuestionsResponse; types: TypesResponse }) {
  // A "session" key reshuffles the question order on restart.
  const [session, setSession] = useState(0)
  const ordered: MbtiQuestion[] = useMemo(
    () => shuffle(data.questions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.questions, session],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  const total = ordered.length
  const current = ordered[currentIndex]
  const dimension = data.dimensions.find((d) => d.key === current?.dim)
  const selected = current ? answers[current.id] : undefined
  const isLast = currentIndex + 1 === total
  const answered = selected !== undefined

  const result = useMbtiScore(ordered, answers, data.dimensions)

  function select(value: number) {
    if (!current) return
    setAnswers((prev) => ({ ...prev, [current.id]: value }))
  }

  function prev() {
    setCurrentIndex((i) => Math.max(0, i - 1))
  }

  function next() {
    if (!answered) return
    if (isLast) {
      setSubmitted(true)
      return
    }
    setCurrentIndex((i) => Math.min(total - 1, i + 1))
  }

  function restart() {
    setAnswers({})
    setCurrentIndex(0)
    setSubmitted(false)
    setSession((s) => s + 1)
  }

  if (submitted) {
    const typeInfo = types.types[result.typeCode] ?? null
    return (
      <ResultView
        result={result}
        typeInfo={typeInfo}
        typeName={types.typeNames[result.typeCode] ?? result.typeCode}
        typeEmoji={types.typeEmoji[result.typeCode] ?? '🧠'}
        onRestart={restart}
      />
    )
  }

  if (!current) return null

  return (
    <div>
      <ProgressBar current={currentIndex + 1} total={total} />

      <QuestionCard
        question={current}
        dimension={dimension}
        index={currentIndex}
        options={data.options}
        optionEmoji={data.optionEmoji}
        selected={selected}
        onSelect={select}
      />

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={prev} disabled={currentIndex === 0}>
          ← 上一题
        </Button>
        <span className="hidden text-xs text-muted sm:block">
          {isLast ? '最后一题' : `还剩 ${total - currentIndex - 1} 题`}
        </span>
        <Button onClick={next} disabled={!answered}>
          {isLast ? '✨ 查看结果' : '下一题 →'}
        </Button>
      </div>
    </div>
  )
}
