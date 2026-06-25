import { useState, useCallback } from 'react'
import { apiPost, ApiError } from '@/lib/api'
import type { FortuneSystem } from './types'

interface FortuneState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Typed POST helper for the six 灵占 endpoints, with local loading/error state.
 * The backend may also return a 200 body with an `error` field — treated as a failure.
 */
export function useFortuneApi<T extends { error?: string }>(system: FortuneSystem) {
  const [state, setState] = useState<FortuneState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const run = useCallback(
    async (body: Record<string, unknown>) => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const data = await apiPost<T>(`/api/fortune/${system}`, body)
        if (data && data.error) {
          setState({ data: null, loading: false, error: data.error })
          return null
        }
        setState({ data, loading: false, error: null })
        return data
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : '未知错误'
        setState({ data: null, loading: false, error: msg })
        return null
      }
    },
    [system],
  )

  const reset = useCallback(() => setState({ data: null, loading: false, error: null }), [])

  return { ...state, run, reset }
}
