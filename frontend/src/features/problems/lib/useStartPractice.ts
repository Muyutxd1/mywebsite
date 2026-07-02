import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { IdListResponse, RandomIdsResponse } from '../types'
import type { PracticeSetup } from '../components/PracticeSetupSheet'
import { usePracticeStore } from '../store/practice'
import { idSetIds, isIdSet, newSeed, newSid, seededShuffle, sessionToQuery } from './session'

const BASE = '/api/problems'

/**
 * Resolve a set definition (`f`: filters query string or `ids:` list) into an
 * ordered id list, create the session, and enter the player. seq order comes
 * from /ids, random from the seed-deterministic /random shuffle — so the run
 * URL alone reproduces the same sequence anywhere.
 */
export function useStartPractice() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useCallback(
    async ({
      f,
      label,
      setup,
    }: {
      f: string
      label: string
      setup: PracticeSetup
      total?: number
    }) => {
      const seed = setup.mode === 'random' ? newSeed() : 0
      let ids: string[]
      if (isIdSet(f)) {
        ids = idSetIds(f)
        if (setup.mode === 'random') ids = seededShuffle(ids, seed)
      } else if (setup.mode === 'random') {
        const res = await qc.fetchQuery({
          queryKey: ['problems', 'random', f, seed, 500],
          queryFn: () => apiGet<RandomIdsResponse>(`${BASE}/random?${f}${f ? '&' : ''}seed=${seed}&count=500`),
          staleTime: Infinity,
        })
        ids = res.ids
      } else {
        const res = await qc.fetchQuery({
          queryKey: ['problems', 'ids', f, 500],
          queryFn: () => apiGet<IdListResponse>(`${BASE}/ids?${f}${f ? '&' : ''}limit=500`),
          staleTime: Infinity,
        })
        ids = res.ids
      }

      if (setup.skipSolved) {
        const progress = usePracticeStore.getState().progress
        const remaining = ids.filter((id) => progress[id]?.status !== 'solved')
        if (remaining.length > 0) ids = remaining
      }
      if (setup.n > 0) ids = ids.slice(0, setup.n)
      if (ids.length === 0) return

      const sid = newSid()
      usePracticeStore.getState().upsertSession({
        sid,
        f,
        label,
        mode: setup.mode,
        seed,
        n: setup.n,
        ids,
        cursor: 0,
        record: {},
        startedAt: Date.now(),
      })
      navigate(
        `/problems/practice/run?${sessionToQuery({ f, mode: setup.mode, seed, n: setup.n, sk: setup.skipSolved, sid })}`,
      )
    },
    [navigate, qc],
  )
}
