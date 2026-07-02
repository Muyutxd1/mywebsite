import { useEffect, useMemo, useState } from 'react'
import { Button, Sheet } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useProblemList } from '../api/queries'
import { EMPTY_FILTERS, type ProblemFilters } from '../api/filters'
import type { FacetsResponse } from '../types'

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string; count?: number }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={!value} onClick={() => onChange('')}>
          全部
        </FilterChip>
        {options.map((o) => (
          <FilterChip key={o.value} active={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
            {o.count !== undefined && <span className="ml-1 opacity-60">{o.count}</span>}
          </FilterChip>
        ))}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border-soft bg-surface-2 text-fg-soft hover:border-accent/40 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

/** Level-by-level drill-down over the 4-level category taxonomy. */
function CategoryDrill({
  facets,
  draft,
  setDraft,
}: {
  facets: FacetsResponse
  draft: ProblemFilters
  setDraft: (f: Partial<ProblemFilters>) => void
}) {
  const crumbs = [draft.level1, draft.level2, draft.level3, draft.level4].filter(Boolean)
  const options = useMemo(() => {
    if (!draft.level1) return facets.level1.map((o) => ({ value: o.value, count: o.count }))
    if (!draft.level2)
      return facets.level2.filter((o) => o.l1 === draft.level1).map((o) => ({ value: o.value, count: o.count }))
    if (!draft.level3)
      return facets.level3
        .filter((o) => o.l1 === draft.level1 && o.l2 === draft.level2)
        .map((o) => ({ value: o.value, count: o.count }))
    if (!draft.level4)
      return facets.level4
        .filter((o) => o.l1 === draft.level1 && o.l2 === draft.level2)
        .map((o) => ({ value: o.value, count: o.count }))
    return []
  }, [facets, draft.level1, draft.level2, draft.level3, draft.level4])

  const pick = (v: string) => {
    if (!draft.level1) setDraft({ level1: v })
    else if (!draft.level2) setDraft({ level2: v })
    else if (!draft.level3) setDraft({ level3: v })
    else if (!draft.level4) setDraft({ level4: v })
  }
  const truncate = (depth: number) => {
    const clear: Partial<ProblemFilters> = {}
    if (depth < 1) clear.level1 = ''
    if (depth < 2) clear.level2 = ''
    if (depth < 3) clear.level3 = ''
    if (depth < 4) clear.level4 = ''
    setDraft(clear)
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">学科分类</p>
      {crumbs.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
          <button type="button" className="text-accent hover:underline" onClick={() => truncate(0)}>
            全部
          </button>
          {crumbs.map((c, i) => (
            <span key={c} className="flex items-center gap-1">
              <span className="text-faint">›</span>
              <button
                type="button"
                className={cn(i === crumbs.length - 1 ? 'font-medium text-fg' : 'text-accent hover:underline')}
                onClick={() => truncate(i + 1)}
              >
                {c}
              </button>
            </span>
          ))}
        </div>
      )}
      {options.length > 0 ? (
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
          {options.map((o) => (
            <FilterChip key={o.value} active={false} onClick={() => pick(o.value)}>
              {o.value}
              <span className="ml-1 opacity-60">{o.count}</span>
            </FilterChip>
          ))}
        </div>
      ) : (
        <p className="text-xs text-faint">已到最细分类</p>
      )}
    </div>
  )
}

/**
 * Draft-state filter panel: edits are local until「查看 N 题」commits them to
 * the URL. Bottom sheet on mobile, right panel on desktop (shared Sheet).
 */
export function FilterSheet({
  open,
  onClose,
  filters,
  facets,
  onApply,
}: {
  open: boolean
  onClose: () => void
  filters: ProblemFilters
  facets: FacetsResponse
  onApply: (f: ProblemFilters) => void
}) {
  const [draft, setDraftState] = useState<ProblemFilters>(filters)
  useEffect(() => {
    if (open) setDraftState(filters)
  }, [open, filters])
  const setDraft = (updates: Partial<ProblemFilters>) =>
    setDraftState((d) => ({ ...d, ...updates }))

  // Live count for the commit button (1-row page piggybacks the list query).
  const { data: count } = useProblemList(draft, 1, 1)

  const compOptions = useMemo(() => {
    const region = draft.region
    return facets.competitions
      .filter((c) => !region || c.region === region)
      .slice(0, 40)
      .map((c) => ({ value: c.comp_key, label: c.name_zh, count: c.count }))
  }, [facets, draft.region])

  const recentYears = facets.years.slice(0, 26)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="筛选"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setDraftState({ ...EMPTY_FILTERS, q: draft.q, sort: draft.sort })}>
            重置
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
          >
            查看 {count ? count.total : '…'} 题
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <ChipGroup
          label="难度"
          options={facets.difficulties.map((d) => ({ value: d.value, label: d.label ?? d.value, count: d.count }))}
          value={draft.difficulty}
          onChange={(v) => setDraft({ difficulty: v })}
        />
        <ChipGroup
          label="地区"
          options={facets.regions.map((r) => ({ value: r.value, label: r.label ?? r.value, count: r.count }))}
          value={draft.region}
          onChange={(v) => setDraft({ region: v, comp: '', round: '' })}
        />
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">竞赛</p>
          <select
            value={draft.comp}
            onChange={(e) => setDraft({ comp: e.target.value, round: '' })}
            className="h-10 w-full rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-fg focus:border-accent/50 focus:outline-none"
          >
            <option value="">全部竞赛</option>
            {compOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}（{c.count}）
              </option>
            ))}
          </select>
        </div>
        <CategoryDrill facets={facets} draft={draft} setDraft={setDraft} />
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">年份</p>
          <div className="flex items-center gap-2">
            <select
              value={draft.year_from}
              onChange={(e) => setDraft({ year_from: e.target.value, year: '' })}
              className="h-10 flex-1 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-fg focus:border-accent/50 focus:outline-none"
            >
              <option value="">起始年</option>
              {recentYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-muted">—</span>
            <select
              value={draft.year_to}
              onChange={(e) => setDraft({ year_to: e.target.value, year: '' })}
              className="h-10 flex-1 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-fg focus:border-accent/50 focus:outline-none"
            >
              <option value="">截止年</option>
              {recentYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-fg-soft">
            <input
              type="checkbox"
              checked={draft.year === 'unknown'}
              onChange={(e) =>
                setDraft({ year: e.target.checked ? 'unknown' : '', year_from: '', year_to: '' })
              }
              className="accent-[var(--color-accent)]"
            />
            只看年份未知（{facets.yearUnknown}）
          </label>
        </div>
        <ChipGroup
          label="题型"
          options={facets.problemTypes.map((t) => ({ value: t.value, label: t.label ?? t.value, count: t.count }))}
          value={draft.problem_type}
          onChange={(v) => setDraft({ problem_type: v })}
        />
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-fg-soft">
            <input
              type="checkbox"
              checked={draft.has_solution === '1'}
              onChange={(e) => setDraft({ has_solution: e.target.checked ? '1' : '' })}
              className="accent-[var(--color-accent)]"
            />
            有解答
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-soft">
            <input
              type="checkbox"
              checked={draft.translated === '1'}
              onChange={(e) => setDraft({ translated: e.target.checked ? '1' : '' })}
              className="accent-[var(--color-accent)]"
            />
            有中文翻译
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-soft">
            <input
              type="checkbox"
              checked={draft.qscope === 'all'}
              onChange={(e) => setDraft({ qscope: e.target.checked ? 'all' : '' })}
              className="accent-[var(--color-accent)]"
            />
            搜索也匹配解答（慢）
          </label>
        </div>
      </div>
    </Sheet>
  )
}
