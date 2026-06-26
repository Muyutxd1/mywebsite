import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ProgressStatus = 'attempted' | 'solved'

interface ProblemsState {
  favorites: Record<string, number> // id -> ts
  progress: Record<string, { status: ProgressStatus; ts: number }>
  toggleFavorite: (id: string) => void
  setStatus: (id: string, status: ProgressStatus) => void
  clearStatus: (id: string) => void
}

/** Client-only favorites + practice progress, persisted to localStorage. */
export const useProblemsStore = create<ProblemsState>()(
  persist(
    (set) => ({
      favorites: {},
      progress: {},
      toggleFavorite: (id) =>
        set((s) => {
          const favorites = { ...s.favorites }
          if (favorites[id]) delete favorites[id]
          else favorites[id] = Date.now()
          return { favorites }
        }),
      setStatus: (id, status) =>
        set((s) => ({ progress: { ...s.progress, [id]: { status, ts: Date.now() } } })),
      clearStatus: (id) =>
        set((s) => {
          const progress = { ...s.progress }
          delete progress[id]
          return { progress }
        }),
    }),
    { name: 'mysite.problems.v1' },
  ),
)

/** Selector hooks (stable, avoid re-render storms). */
export const useIsFavorite = (id: string) =>
  useProblemsStore((s) => Boolean(s.favorites[id]))
export const useFavoriteCount = () =>
  useProblemsStore((s) => Object.keys(s.favorites).length)
export const useStatus = (id: string) =>
  useProblemsStore((s) => s.progress[id]?.status)
