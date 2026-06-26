import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type {
  CompetitionsResponse,
  FacetsResponse,
  FullProblem,
  ProblemFilters,
  ProblemListResponse,
} from './types'

/** Serialize active filters (+ paging) into a query string, dropping blanks. */
export function filtersToQuery(
  filters: Partial<ProblemFilters>,
  extra: Record<string, string | number> = {},
): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v != null && String(v).trim() !== '') sp.set(k, String(v).trim())
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && String(v) !== '') sp.set(k, String(v))
  }
  return sp.toString()
}

export function useFacets() {
  return useQuery({
    queryKey: ['problems', 'facets'],
    queryFn: () => apiGet<FacetsResponse>('/api/problems/facets'),
    staleTime: Infinity,
  })
}

export function useProblemList(filters: ProblemFilters, page: number, enabled = true) {
  return useQuery({
    queryKey: ['problems', 'list', filters, page],
    queryFn: () =>
      apiGet<ProblemListResponse>(
        `/api/problems?${filtersToQuery(filters, { page, pageSize: 20 })}`,
      ),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useCompetitions(filters: ProblemFilters, enabled = true) {
  // competition + sort are irrelevant when listing competitions; blank them so
  // filtersToQuery drops them (it omits empty values).
  const rest = { ...filters, competition: '', sort: '' }
  return useQuery({
    queryKey: ['problems', 'competitions', rest],
    queryFn: () =>
      apiGet<CompetitionsResponse>(`/api/problems/competitions?${filtersToQuery(rest)}`),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useProblem(id: string | undefined) {
  return useQuery({
    queryKey: ['problems', 'detail', id],
    queryFn: () => apiGet<FullProblem>(`/api/problems/${id}`),
    enabled: Boolean(id),
    staleTime: Infinity,
  })
}

export function useDaily() {
  return useQuery({
    queryKey: ['problems', 'daily'],
    queryFn: () => apiGet<FullProblem & { date: string }>('/api/problems/daily'),
    staleTime: 1000 * 60 * 60,
  })
}

/** Fetch N favorited problems by id (for the 收藏 view). */
export function useFavoriteProblems(ids: string[]) {
  return useQuery({
    queryKey: ['problems', 'favorites', [...ids].sort()],
    queryFn: async () => {
      const results = await Promise.all(
        ids.map((id) =>
          apiGet<FullProblem>(`/api/problems/${id}`).catch(() => null),
        ),
      )
      return results.filter(Boolean) as FullProblem[]
    },
    enabled: ids.length > 0,
  })
}
