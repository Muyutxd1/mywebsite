import { cn } from '@/lib/cn'
import { DIFFICULTY_LABEL } from '../data/labels'
import type { FacetsResponse } from '../types'
import type { ProblemFilters } from '../api/filters'

interface Chip {
  key: keyof ProblemFilters
  label: string
  /** Clearing one filter may need to cascade (level1 clears level2-4). */
  clears: Partial<ProblemFilters>
}

export function buildChips(f: ProblemFilters, facets?: FacetsResponse): Chip[] {
  const chips: Chip[] = []
  const compName = (k: string) =>
    facets?.competitions.find((c) => c.comp_key === k)?.name_zh ?? k
  const regionName = (k: string) =>
    facets?.regions.find((r) => r.value === k)?.label ?? k

  if (f.region) chips.push({ key: 'region', label: regionName(f.region), clears: { region: '' } })
  if (f.comp) chips.push({ key: 'comp', label: compName(f.comp), clears: { comp: '', round: '' } })
  if (f.round) chips.push({ key: 'round', label: `卷：${f.round}`, clears: { round: '' } })
  if (f.year === 'unknown') chips.push({ key: 'year', label: '年份未知', clears: { year: '' } })
  else if (f.year) chips.push({ key: 'year', label: `${f.year} 年`, clears: { year: '' } })
  if (f.year_from || f.year_to)
    chips.push({
      key: 'year_from',
      label: `${f.year_from || '…'}–${f.year_to || '…'}`,
      clears: { year_from: '', year_to: '' },
    })
  if (f.difficulty)
    chips.push({ key: 'difficulty', label: DIFFICULTY_LABEL[f.difficulty] ?? f.difficulty, clears: { difficulty: '' } })
  if (f.problem_type) {
    const label = facets?.problemTypes.find((t) => t.value === f.problem_type)?.label ?? f.problem_type
    chips.push({ key: 'problem_type', label: label ?? f.problem_type, clears: { problem_type: '' } })
  }
  const deepest = f.level4 || f.level3 || f.level2 || f.level1
  if (deepest)
    chips.push({
      key: 'level1',
      label: deepest,
      clears: { level1: '', level2: '', level3: '', level4: '' },
    })
  if (f.has_solution) chips.push({ key: 'has_solution', label: '有解答', clears: { has_solution: '' } })
  if (f.translated) chips.push({ key: 'translated', label: '有中文', clears: { translated: '' } })
  return chips
}

/** Removable chips reflecting the active filter set + 清空全部. */
export function ActiveFilterChips({
  filters,
  facets,
  onPatch,
  onClearAll,
  className,
}: {
  filters: ProblemFilters
  facets?: FacetsResponse
  onPatch: (updates: Partial<ProblemFilters>) => void
  onClearAll: () => void
  className?: string
}) {
  const chips = buildChips(filters, facets)
  if (chips.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {chips.map((c) => (
        <button
          key={`${c.key}-${c.label}`}
          type="button"
          onClick={() => onPatch(c.clears)}
          className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 py-1 pl-3 pr-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
        >
          {c.label}
          <span aria-hidden className="text-accent/70">✕</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="rounded-full px-2.5 py-1 text-xs text-muted transition-colors hover:text-fg"
      >
        清空全部
      </button>
    </div>
  )
}
