import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { FacetsResponse, ProblemFilters } from '../types'

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
      <span className="px-0.5 text-[11px] font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

export function ProblemFilterBar({
  facets,
  filters,
  onChange,
  onReset,
  total,
  page,
  pages,
  loading,
}: {
  facets: FacetsResponse
  filters: ProblemFilters
  onChange: (patch: Partial<ProblemFilters>) => void
  onReset: () => void
  total: number
  page: number
  pages: number
  loading?: boolean
}) {
  const [q, setQ] = useState(filters.q)
  const [more, setMore] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => setQ(filters.q), [filters.q])
  useEffect(() => () => clearTimeout(timer.current), [])

  function onSearch(value: string) {
    setQ(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange({ q: value }), 250)
  }

  // Cascading option sets.
  const level2 = useMemo(
    () => facets.level2.filter((c) => !filters.level1 || c.l1 === filters.level1),
    [facets.level2, filters.level1],
  )
  const level3 = useMemo(
    () =>
      facets.level3.filter(
        (c) =>
          (!filters.level1 || c.l1 === filters.level1) &&
          (!filters.level2 || c.l2 === filters.level2),
      ),
    [facets.level3, filters.level1, filters.level2],
  )
  const level4 = useMemo(
    () =>
      facets.level4.filter(
        (c) =>
          (!filters.level1 || c.l1 === filters.level1) &&
          (!filters.level2 || c.l2 === filters.level2),
      ),
    [facets.level4, filters.level1, filters.level2],
  )

  const activeCount = [
    filters.config, filters.series, filters.level1, filters.level2,
    filters.level3, filters.level4, filters.year, filters.difficulty,
    filters.problem_type,
  ].filter(Boolean).length

  const selCls = 'h-9 text-xs sm:text-sm'

  return (
    <div className="rounded-2xl border border-border-soft bg-surface/60 p-3 sm:p-4">
      {/* primary row — always visible */}
      <div className="flex flex-wrap items-end gap-2">
        <Labeled label="地区">
          <Select className={selCls} value={filters.config}
            onChange={(e) => onChange({ config: e.target.value, competition: '' })}>
            <option value="">全部地区</option>
            {facets.countries.map((c) => (
              <option key={c.value} value={c.value}>{c.label}（{c.count}）</option>
            ))}
          </Select>
        </Labeled>

        <Labeled label="一级类">
          <Select className={selCls} value={filters.level1}
            onChange={(e) => onChange({ level1: e.target.value, level2: '', level3: '', level4: '' })}>
            <option value="">全部学科</option>
            {facets.level1.map((c) => (
              <option key={c.value} value={c.value}>{c.value}（{c.count}）</option>
            ))}
          </Select>
        </Labeled>

        {facets.difficulties.length > 0 && (
          <Labeled label="难度">
            <Select className={selCls} value={filters.difficulty}
              onChange={(e) => onChange({ difficulty: e.target.value })}>
              <option value="">全部难度</option>
              {facets.difficulties.map((d) => (
                <option key={d.value} value={d.value}>{d.label}（{d.count}）</option>
              ))}
            </Select>
          </Labeled>
        )}

        <div className="relative min-w-[10rem] flex-[2] basis-full sm:basis-auto">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input type="search" value={q} onChange={(e) => onSearch(e.target.value)}
            placeholder="搜索题面 / 解答 / 分类（≥3 字更准）…"
            className="h-9 w-full rounded-full border border-border-soft bg-surface-2 pl-9 pr-3 text-sm text-fg placeholder:text-faint outline-none transition-colors focus:border-accent focus:bg-surface-3" />
        </div>

        <Button size="sm" variant="ghost" className="h-9" onClick={() => setMore((v) => !v)}>
          {more ? '收起' : '更多筛选'}
          {activeCount > 0 && <span className="ml-1 rounded-full bg-accent/20 px-1.5 text-[10px] text-accent">{activeCount}</span>}
        </Button>
      </div>

      {/* secondary row */}
      <div className={cn('mt-3 flex-wrap items-end gap-2', more ? 'flex' : 'hidden lg:flex')}>
        <Labeled label="二级类">
          <Select className={selCls} value={filters.level2}
            onChange={(e) => onChange({ level2: e.target.value, level3: '', level4: '' })}>
            <option value="">全部二级</option>
            {level2.map((c) => (<option key={c.value} value={c.value}>{c.value}</option>))}
          </Select>
        </Labeled>
        <Labeled label="三级类">
          <Select className={selCls} value={filters.level3}
            onChange={(e) => onChange({ level3: e.target.value })}>
            <option value="">全部三级</option>
            {level3.map((c) => (<option key={c.value} value={c.value}>{c.value}</option>))}
          </Select>
        </Labeled>
        <Labeled label="四级类">
          <Select className={selCls} value={filters.level4}
            onChange={(e) => onChange({ level4: e.target.value })}>
            <option value="">全部四级</option>
            {level4.map((c) => (<option key={c.value} value={c.value}>{c.value}</option>))}
          </Select>
        </Labeled>
        <Labeled label="年份">
          <Select className={selCls} value={filters.year}
            onChange={(e) => onChange({ year: e.target.value })}>
            <option value="">全部年份</option>
            {facets.years.map((y) => (<option key={y} value={String(y)}>{y}</option>))}
            <option value="unknown">年份未知（{facets.yearUnknown}）</option>
          </Select>
        </Labeled>
        <Labeled label="题型">
          <Select className={selCls} value={filters.problem_type}
            onChange={(e) => onChange({ problem_type: e.target.value })}>
            <option value="">全部题型</option>
            {facets.problemTypes.map((t) => (<option key={t.value} value={t.value}>{t.label}（{t.count}）</option>))}
          </Select>
        </Labeled>
        <Labeled label="排序">
          <Select className={selCls} value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}>
            <option value="">默认</option>
            <option value="year_desc">年份新→旧</option>
            <option value="year_asc">年份旧→新</option>
            <option value="difficulty_asc">难度低→高</option>
            <option value="difficulty_desc">难度高→低</option>
          </Select>
        </Labeled>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>
          {loading ? '检索中…' : total > 0 ? (
            <>共 <span className="font-semibold text-fg-soft">{total.toLocaleString()}</span> 题
              {pages > 1 && <span className="text-faint">{' · '}第 {page}/{pages} 页</span>}</>
          ) : '0 题'}
        </span>
        {activeCount + (filters.q ? 1 : 0) > 0 && (
          <button onClick={onReset} className="text-faint transition-colors hover:text-accent">清空筛选</button>
        )}
      </div>
    </div>
  )
}
