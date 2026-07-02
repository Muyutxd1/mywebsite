import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { filtersKey, filtersToQuery, type ProblemFilters } from './filters'
import type {
  BatchResponse,
  CompetitionMatrixResponse,
  ContextResponse,
  DailyProblem,
  FacetsResponse,
  FullProblem,
  IdListResponse,
  ProblemListResponse,
  RandomIdsResponse,
  RegistryResponse,
  StatsResponse,
} from '../types'

const BASE = '/api/problems'

export function useRegistry() {
  return useQuery({
    queryKey: ['problems', 'registry'],
    queryFn: () => apiGet<RegistryResponse>(`${BASE}/registry`),
    staleTime: Infinity,
  })
}

export function useFacets() {
  return useQuery({
    queryKey: ['problems', 'facets'],
    queryFn: () => apiGet<FacetsResponse>(`${BASE}/facets`),
    staleTime: Infinity,
  })
}

export function useCompetitionMatrix(compKey: string) {
  return useQuery({
    queryKey: ['problems', 'matrix', compKey],
    queryFn: () => apiGet<CompetitionMatrixResponse>(`${BASE}/competitions/${compKey}`),
    staleTime: Infinity,
    enabled: Boolean(compKey),
  })
}

export function useProblemList(filters: ProblemFilters, page: number, pageSize = 20) {
  return useQuery({
    queryKey: ['problems', 'list', filtersKey(filters), page, pageSize],
    queryFn: () =>
      apiGet<ProblemListResponse>(`${BASE}/?${filtersToQuery(filters, { page, pageSize })}`),
    placeholderData: keepPreviousData,
  })
}

export function useProblem(id: string | undefined) {
  return useQuery({
    queryKey: ['problems', 'detail', id],
    queryFn: () => apiGet<FullProblem>(`${BASE}/${id}`),
    staleTime: Infinity,
    enabled: Boolean(id),
  })
}

/** prev/next inside the caller's filter context; refresh/share-safe. */
export function useProblemContext(id: string | undefined, filters: ProblemFilters | null) {
  return useQuery({
    queryKey: ['problems', 'context', id, filters ? filtersKey(filters) : null],
    queryFn: () =>
      apiGet<ContextResponse>(`${BASE}/${id}/context?${filtersToQuery(filters ?? {})}`),
    staleTime: Infinity,
    enabled: Boolean(id && filters),
  })
}

export function useBatch(ids: string[]) {
  return useQuery({
    queryKey: ['problems', 'batch', ids.join(',')],
    queryFn: () => apiPost<BatchResponse>(`${BASE}/batch`, { ids }),
    enabled: ids.length > 0,
  })
}

export function useIdList(filters: ProblemFilters | null, limit = 500) {
  return useQuery({
    queryKey: ['problems', 'ids', filters ? filtersKey(filters) : null, limit],
    queryFn: () => apiGet<IdListResponse>(`${BASE}/ids?${filtersToQuery(filters ?? {}, { limit })}`),
    staleTime: Infinity,
    enabled: Boolean(filters),
  })
}

/** Deterministic: same seed + same filters => same order (shareable). */
export function useRandomIds(filters: ProblemFilters | null, seed: number, count: number) {
  return useQuery({
    queryKey: ['problems', 'random', filters ? filtersKey(filters) : null, seed, count],
    queryFn: () =>
      apiGet<RandomIdsResponse>(`${BASE}/random?${filtersToQuery(filters ?? {}, { seed, count })}`),
    staleTime: Infinity,
    enabled: Boolean(filters) && seed > 0,
  })
}

export function useDaily() {
  return useQuery({
    queryKey: ['problems', 'daily'],
    queryFn: () => apiGet<DailyProblem>(`${BASE}/daily`),
    staleTime: 60 * 60 * 1000,
  })
}

export function useStats() {
  return useQuery({
    queryKey: ['problems', 'stats'],
    queryFn: () => apiGet<StatsResponse>(`${BASE}/stats`),
    staleTime: Infinity,
  })
}

/** Prefetch the next problem so practice/detail navigation feels instant. */
export function usePrefetchProblem() {
  const qc = useQueryClient()
  return useCallback(
    (id: string | null | undefined) => {
      if (!id) return
      qc.prefetchQuery({
        queryKey: ['problems', 'detail', id],
        queryFn: () => apiGet<FullProblem>(`${BASE}/${id}`),
        staleTime: Infinity,
      })
    },
    [qc],
  )
}
