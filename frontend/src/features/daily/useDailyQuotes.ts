import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { QuotesResponse, TodayResponse } from './types'

/** Today's deterministic quote — rendered first, fast. */
export function useTodayQuote() {
  return useQuery({
    queryKey: ['daily', 'today'],
    queryFn: () => apiGet<TodayResponse>('/api/daily/today'),
    staleTime: Infinity,
  })
}

/**
 * Full quote list — lazily fetched (enabled) only once the user wants to
 * navigate (换一句 / 随机). The dataset is static so cache it forever.
 */
export function useAllQuotes(enabled: boolean) {
  return useQuery({
    queryKey: ['daily', 'quotes'],
    queryFn: () => apiGet<QuotesResponse>('/api/daily/quotes'),
    staleTime: Infinity,
    enabled,
  })
}
