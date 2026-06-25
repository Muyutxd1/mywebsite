import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { EmptyState, ErrorState, PageLoader } from '@/components/ui'
import { SectionHeader } from '@/components/home/SectionHeader'
import { ChapterAccordion } from './ChapterAccordion'
import { SearchBar } from './SearchBar'
import type { KbChapter, KnowledgeBase } from './types'

const KB_LABEL: Record<string, string> = {
  combinatorics: 'Combinatorics · 组合',
  'number-theory': 'Number Theory · 数论',
}

/** Build the lowercase haystack for one entry, including its chapter title. */
function haystack(
  entry: KbChapter['entries'][number],
  chapterTitle: string,
): string {
  return [
    entry.title,
    entry.statement,
    entry.formula,
    entry.detail,
    (entry.tags ?? []).join(' '),
    chapterTitle,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export default function KnowledgeBasePage() {
  const { kb = '' } = useParams<{ kb: string }>()

  const query = useQuery({
    queryKey: ['knowledge', kb],
    queryFn: () => apiGet<KnowledgeBase>(`/api/knowledge/${kb}`),
    staleTime: Infinity,
    enabled: Boolean(kb),
  })

  // Raw vs. debounced search query.
  const [rawSearch, setRawSearch] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch.trim().toLowerCase()), 150)
    return () => clearTimeout(t)
  }, [rawSearch])

  // Reset search + collapse state when switching knowledge bases.
  useEffect(() => {
    setRawSearch('')
    setSearch('')
    setOpenSet(new Set())
  }, [kb])

  const [openSet, setOpenSet] = useState<Set<number>>(new Set())
  const toggle = (num: number) =>
    setOpenSet((prev) => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })

  const chapters = query.data?.chapters ?? []
  const searching = search.length > 0

  // Filter chapters/entries during search.
  const { visibleChapters, matchCount } = useMemo(() => {
    if (!searching) return { visibleChapters: chapters, matchCount: 0 }
    let count = 0
    const filtered: KbChapter[] = []
    for (const ch of chapters) {
      const entries = ch.entries.filter((e) => haystack(e, ch.title).includes(search))
      if (entries.length) {
        filtered.push({ ...ch, entries })
        count += entries.length
      }
    }
    return { visibleChapters: filtered, matchCount: count }
  }, [chapters, search, searching])

  const resultText = searching ? `${matchCount} 条匹配` : undefined

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {query.isLoading && <PageLoader label="加载知识库…" />}

      {query.isError && (
        <ErrorState
          title="加载失败"
          description={(query.error as Error)?.message ?? '请稍后重试。'}
          onRetry={() => query.refetch()}
        />
      )}

      {query.data && (
        <>
          <SectionHeader
            label={KB_LABEL[kb] ?? '知识库'}
            title={query.data.title}
            description={query.data.subtitle}
          />

          <SearchBar value={rawSearch} onChange={setRawSearch} resultText={resultText} />

          {visibleChapters.length === 0 ? (
            <EmptyState
              title={searching ? '未找到匹配的知识点' : '暂无内容'}
              description={searching ? '换一个关键词试试。' : undefined}
            />
          ) : (
            <ChapterAccordion
              chapters={visibleChapters}
              openSet={openSet}
              onToggle={toggle}
              forceOpen={searching}
            />
          )}
        </>
      )}
    </div>
  )
}
