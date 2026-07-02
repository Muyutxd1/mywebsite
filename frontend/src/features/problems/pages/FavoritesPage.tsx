import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { useBatch } from '../api/queries'
import { ProblemListItem } from '../components/ProblemListItem'
import { PracticeSetupSheet, type PracticeSetup } from '../components/PracticeSetupSheet'
import { useStartPractice } from '../lib/useStartPractice'
import { usePracticeStore } from '../store/practice'

/** Favorites hydrate through ONE batch POST (v1 fired a request per id). */
export default function FavoritesPage() {
  const favorites = usePracticeStore((s) => s.favorites)
  const ids = useMemo(
    () => Object.entries(favorites).sort((a, b) => b[1] - a[1]).map(([id]) => id),
    [favorites],
  )
  const { data, isLoading, isError, refetch } = useBatch(ids.slice(0, 200))
  const [setupOpen, setSetupOpen] = useState(false)
  const startPractice = useStartPractice()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-5 flex items-end justify-between gap-2">
        <div>
          <Link to="/problems" className="text-xs text-muted hover:text-accent">
            ← 返回题库
          </Link>
          <h1 className="mt-1 text-xl font-bold sm:text-2xl">我的收藏</h1>
        </div>
        {ids.length > 0 && (
          <Button size="sm" onClick={() => setSetupOpen(true)}>
            ▶ 刷收藏（{ids.length}）
          </Button>
        )}
      </header>

      {ids.length === 0 && (
        <EmptyState
          title="还没有收藏"
          description="在题目列表或详情页点星标，就会出现在这里"
          action={
            <Link to="/problems" className="text-sm text-accent hover:underline">
              去逛题库 →
            </Link>
          }
        />
      )}

      {ids.length > 0 && isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && (
        <div className="space-y-3">
          {data.items.map((p) => (
            <ProblemListItem key={p.id} problem={p} />
          ))}
        </div>
      )}

      <PracticeSetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        label="我的收藏"
        total={ids.length}
        onStart={(setup: PracticeSetup) => {
          setSetupOpen(false)
          startPractice({ f: `ids:${ids.join(',')}`, label: '我的收藏', setup })
        }}
      />
    </div>
  )
}
