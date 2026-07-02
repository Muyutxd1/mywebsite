import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * The one "set definition" shared by the search page, competition page,
 * detail-page context (prev/next) and practice sessions. Everything is a
 * string so it round-trips through URL query params losslessly.
 */
export interface ProblemFilters {
  q: string
  qscope: string // '' | 'all'
  region: string
  comp: string
  round: string
  year: string // '2023' | 'unknown' | ''
  year_from: string
  year_to: string
  difficulty: string
  problem_type: string
  level1: string
  level2: string
  level3: string
  level4: string
  has_solution: string // '1' | ''
  translated: string // '1' | ''
  sort: string // '' (server default) | relevance | year_desc | ...
}

export const EMPTY_FILTERS: ProblemFilters = {
  q: '', qscope: '', region: '', comp: '', round: '', year: '',
  year_from: '', year_to: '', difficulty: '', problem_type: '',
  level1: '', level2: '', level3: '', level4: '',
  has_solution: '', translated: '', sort: '',
}

export const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as (keyof ProblemFilters)[]

/** Drop empty values and serialize into a URLSearchParams-ready object. */
export function filtersToQuery(f: Partial<ProblemFilters>, extra?: Record<string, string | number>) {
  const params = new URLSearchParams()
  for (const k of FILTER_KEYS) {
    const v = f[k]
    if (v) params.set(k, String(v))
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== '' && v !== undefined && v !== null) params.set(k, String(v))
    }
  }
  return params.toString()
}

/** Stable cache key: sorted, empties dropped, values escaped so a q like
 *  "a&comp=imo" can't collide with a genuinely different filter set. */
export function filtersKey(f: Partial<ProblemFilters>): string {
  return FILTER_KEYS.filter((k) => f[k])
    .map((k) => `${k}=${encodeURIComponent(String(f[k]))}`)
    .join('&')
}

export function parseFilters(sp: URLSearchParams): ProblemFilters {
  const f = { ...EMPTY_FILTERS }
  for (const k of FILTER_KEYS) {
    const v = sp.get(k)
    if (v) f[k] = v
  }
  return f
}

export function countActiveFilters(f: ProblemFilters): number {
  // q/sort don't count as "filters" in the chip count.
  return FILTER_KEYS.filter((k) => k !== 'q' && k !== 'sort' && k !== 'qscope' && f[k]).length
}

/**
 * URL-backed filter + page state (replace-mode writes so browsing doesn't
 * spam history). Filter changes reset the page.
 */
export function useUrlFilters() {
  const [sp, setSp] = useSearchParams()
  const filters = useMemo(() => parseFilters(sp), [sp])
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)

  const patch = useCallback(
    (updates: Partial<ProblemFilters> & { page?: number }) => {
      const next = new URLSearchParams(sp)
      const { page: nextPage, ...rest } = updates
      let filtersChanged = false
      for (const [k, v] of Object.entries(rest)) {
        const oldV = next.get(k) ?? ''
        const newV = v ? String(v) : ''
        if (oldV === newV) continue // same-value clicks must not reset the page
        filtersChanged = true
        if (newV) next.set(k, newV)
        else next.delete(k)
      }
      if (nextPage !== undefined) {
        if (nextPage > 1) next.set('page', String(nextPage))
        else next.delete('page')
      } else if (filtersChanged) {
        next.delete('page')
      }
      setSp(next, { replace: true })
    },
    [sp, setSp],
  )

  const reset = useCallback(() => setSp(new URLSearchParams(), { replace: true }), [setSp])

  return { filters, page, patch, reset }
}
