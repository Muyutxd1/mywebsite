import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { PageLoader, ErrorState, useToast } from '@/components/ui'
import { useTodayQuote, useAllQuotes } from './useDailyQuotes'
import { copyText, formatQuote } from './copy'
import { catMeta } from './categories'
import type { Quote } from './types'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
function dateLine(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${WEEK[d.getDay()]}`
}

const SERIF = '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif'

export default function DailyPage() {
  const toast = useToast()
  const today = useTodayQuote()
  const [index, setIndex] = useState<number | null>(null)
  const [isToday, setIsToday] = useState(true)
  const [anim, setAnim] = useState(0)

  // Prefetch the full list so 换一句 is instant (dataset is tiny).
  const [wantList, setWantList] = useState(false)
  useEffect(() => setWantList(true), [])
  const all = useAllQuotes(wantList)

  useEffect(() => {
    if (today.data && index === null) setIndex(today.data.index)
  }, [today.data, index])

  const quote: Quote | undefined = useMemo(() => {
    if (all.data && index !== null) return all.data.quotes[index]
    return today.data?.quote
  }, [all.data, index, today.data])

  const meta = catMeta(quote?.category)

  const random = useCallback(() => {
    const list = all.data?.quotes
    if (!list || list.length === 0) return
    let n = Math.floor(Math.random() * list.length)
    if (list.length > 1 && n === index) n = (n + 1) % list.length
    setIndex(n)
    setIsToday(false)
    setAnim((a) => a + 1)
  }, [all.data, index])

  const copy = useCallback(async () => {
    if (!quote) return
    const ok = await copyText(formatQuote(quote))
    toast(ok ? '✦ 已复制' : '复制失败', ok ? 'success' : 'danger')
  }, [quote, toast])

  if (today.isLoading) return <PageLoader label="正在翻开今天…" />
  if (today.isError || !quote) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20">
        <ErrorState title="加载失败" description="请稍后重试。" onRetry={() => today.refetch()} />
      </div>
    )
  }

  const navBusy = all.isLoading
  const total = all.data?.total ?? today.data?.total ?? 0

  return (
    <div
      className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden px-5 py-16"
      style={{ '--cat': meta.color } as CSSProperties}
    >
      {/* ambient category-tinted orbs */}
      <div className="cat-glow pointer-events-none absolute -top-16 left-[8%] h-72 w-72 rounded-full opacity-40 blur-2xl animate-[float_15s_ease-in-out_infinite]" />
      <div className="cat-glow pointer-events-none absolute -bottom-10 right-[6%] h-80 w-80 rounded-full opacity-30 blur-3xl animate-[float_21s_ease-in-out_infinite_reverse]" />

      <div className="relative w-full max-w-2xl text-center">
        {/* date line */}
        <p className="mb-12 text-sm tracking-[0.06em] text-muted">
          {isToday ? '今天' : '此刻'} · {today.data ? dateLine(today.data.date) : ''}
        </p>

        {/* quote stage — re-animates on each change */}
        <div key={anim} className="animate-[riseIn_0.55s_var(--ease-out)]">
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-1 -top-14 select-none text-[110px] leading-none opacity-15 sm:-left-4"
              style={{ color: 'var(--cat)', fontFamily: 'Georgia, serif' }}
            >
              &ldquo;
            </span>
            <p
              className="relative mx-auto max-w-xl text-[26px] font-medium leading-[1.85] text-fg sm:text-[30px]"
              style={{ fontFamily: SERIF }}
            >
              {quote.text}
            </p>
          </div>

          {(quote.source || quote.author) && (
            <p className="mt-8 text-[15px] text-fg-soft">
              ——&nbsp;
              {quote.source && <span>《{quote.source}》</span>}
              {quote.source && quote.author && <span className="text-muted">&nbsp;·&nbsp;</span>}
              {quote.author && <span className="text-muted">{quote.author}</span>}
            </p>
          )}

          <div className="mt-7 flex justify-center">
            <span className="cat-tag inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
              <span aria-hidden>{meta.glyph}</span>
              {quote.category ?? '语录'}
            </span>
          </div>
        </div>

        {/* actions */}
        <div className="mt-14 flex items-center justify-center gap-3">
          <button
            onClick={random}
            disabled={navBusy}
            className="cat-btn inline-flex h-12 items-center gap-2 rounded-full px-7 text-[15px] font-medium active:scale-[0.98] disabled:opacity-50"
          >
            <span aria-hidden className="text-lg leading-none">↻</span>
            {navBusy ? '载入中…' : '换一句'}
          </button>
          <button
            onClick={copy}
            className="inline-flex h-12 items-center rounded-full border border-border px-5 text-sm text-fg-soft transition-colors hover:border-fg-soft hover:text-fg"
          >
            复制
          </button>
        </div>

        <p className="mt-10 text-xs text-faint">
          {total} 句精选 · 歌词 · 诗词 · 电影 · 文学 · 哲思 · 语录
        </p>
      </div>
    </div>
  )
}
