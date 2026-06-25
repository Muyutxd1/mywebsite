import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageLoader, ErrorState, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useTodayQuote, useAllQuotes } from './useDailyQuotes'
import { copyText, formatQuote } from './copy'
import type { Quote } from './types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** Chinese date line, e.g. '2026年6月25日 · 星期四', parsed from the API ISO date. */
function formatDateLine(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${WEEKDAYS[d.getDay()]}`
}

export default function DailyPage() {
  const toast = useToast()
  const today = useTodayQuote()

  // Local "current index" — starts at today's deterministic pick. Navigation
  // (next / random) walks the full list, lazily fetched on first interaction.
  const [index, setIndex] = useState<number | null>(null)
  const [wantList, setWantList] = useState(false)
  const all = useAllQuotes(wantList)

  // Seed the index from today's response once it arrives.
  useEffect(() => {
    if (today.data && index === null) setIndex(today.data.index)
  }, [today.data, index])

  const total = all.data?.total ?? today.data?.total ?? 0

  // Resolve the current quote: prefer the full list (post-navigation),
  // fall back to today's quote before the list loads.
  const quote: Quote | undefined = useMemo(() => {
    if (all.data && index !== null) return all.data.quotes[index]
    return today.data?.quote
  }, [all.data, index, today.data])

  const ensureList = useCallback(() => {
    if (!wantList) setWantList(true)
  }, [wantList])

  const handleNext = useCallback(() => {
    ensureList()
    const list = all.data?.quotes
    if (!list || index === null) return
    setIndex((i) => ((i ?? 0) + 1) % list.length)
  }, [all.data, index, ensureList])

  const handleRandom = useCallback(() => {
    ensureList()
    const list = all.data?.quotes
    if (!list) return
    setIndex(Math.floor(Math.random() * list.length))
  }, [all.data, ensureList])

  const handleCopy = useCallback(async () => {
    if (!quote) return
    const ok = await copyText(formatQuote(quote))
    if (ok) toast('✅ 已复制', 'success')
    else toast('复制失败', 'danger')
  }, [quote, toast])

  if (today.isLoading) return <PageLoader label="加载今日一句…" />
  if (today.isError || !quote) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-16 sm:px-6">
        <ErrorState
          title="加载失败"
          description="请稍后重试。"
          onRetry={() => today.refetch()}
        />
      </div>
    )
  }

  const dateLine = today.data ? formatDateLine(today.data.date) : ''
  const navBusy = wantList && all.isLoading

  return (
    <div className="mx-auto max-w-[680px] px-4 py-12 text-center sm:px-6 sm:py-16">
      {/* Eyebrow + title header (site pattern) */}
      <header className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">
          Daily Quote
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">每日一句</h1>
      </header>

      {/* Chinese date line */}
      {dateLine && (
        <p className="mb-10 text-[13px] tracking-[0.08em] text-muted">{dateLine}</p>
      )}

      {/* Quote text with decorative opening quote mark behind it */}
      <div className="relative px-4">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-2 -top-8 select-none font-serif text-[72px] leading-none text-accent/25 sm:-left-4"
        >
          &ldquo;
        </span>
        <p
          className={cn(
            'relative text-[22px] font-medium tracking-[0.03em] text-fg sm:text-2xl',
            navBusy && 'opacity-50 transition-opacity',
          )}
          style={{ lineHeight: 1.8 }}
        >
          {quote.text}
        </p>
      </div>

      {/* Accent separator */}
      <div className="mx-auto my-7 h-0.5 w-10 rounded-full bg-accent/40" />

      {/* Source + author */}
      {quote.source && <p className="text-[15px] text-fg-soft">—— 《{quote.source}》</p>}
      {quote.author && (
        <p className="mt-1 text-sm italic text-muted">{quote.author}</p>
      )}

      {/* Action row — three pill buttons */}
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <PillButton onClick={handleNext} disabled={navBusy}>
          🔄 换一句
        </PillButton>
        <PillButton onClick={handleRandom} disabled={navBusy}>
          🎲 随机
        </PillButton>
        <PillButton onClick={handleCopy}>📋 复制</PillButton>
      </div>

      {all.isError && (
        <p className="mt-4 text-xs text-danger">语录加载失败，请重试换一句</p>
      )}

      {/* Category tag pills */}
      {quote.tag && (
        <div className="mt-10 flex flex-wrap justify-center gap-2 opacity-70">
          <span className="rounded-[10px] bg-surface-2 px-3 py-1 text-[11px] text-muted">
            {quote.tag}
          </span>
        </div>
      )}

      {total > 0 && (
        <p className="mt-8 text-[11px] text-faint">共 {total} 句</p>
      )}
    </div>
  )
}

function PillButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full border border-border bg-surface px-6 py-2.5 text-sm text-fg-soft',
        'transition-all duration-200 hover:border-accent hover:bg-surface-2 hover:text-accent',
        'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
      )}
    >
      {children}
    </button>
  )
}
