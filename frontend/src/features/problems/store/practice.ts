import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type MarkStatus = 'solved' | 'attempted' | 'failed'
export type RecordResult = MarkStatus | 'skipped'

/** Metadata snapshot taken at mark time so stats never re-fetch problems. */
export interface MarkSnap {
  difficulty: string | null
  level1: string | null
  comp_zh: string | null
}

export interface SessionRecordEntry {
  id: string
  result: RecordResult
  revealed: boolean
  ts: number
  snap?: MarkSnap
}

export interface PracticeSession {
  sid: string
  /** Serialized ProblemFilters query string, or `ids:<comma list>` for review sets. */
  f: string
  label: string
  mode: 'seq' | 'random'
  seed: number
  n: number
  ids: string[]
  cursor: number
  record: Record<string, SessionRecordEntry>
  startedAt: number
  finishedAt?: number
}

interface PracticeState {
  favorites: Record<string, number> // id -> ts
  progress: Record<string, { status: MarkStatus; ts: number; snap?: MarkSnap }>
  sessions: Record<string, PracticeSession>
  sessionOrder: string[] // most recent first, LRU-capped

  toggleFavorite: (id: string) => void
  mark: (id: string, status: MarkStatus, snap?: MarkSnap) => void
  clearMark: (id: string) => void
  upsertSession: (session: PracticeSession) => void
  recordAnswer: (sid: string, entry: SessionRecordEntry, cursor?: number) => void
  setCursor: (sid: string, cursor: number) => void
  finishSession: (sid: string) => void
  dropSession: (sid: string) => void
}

const MAX_SESSIONS = 50

/** One-time seed from the v1 store key (favorites + 2-state progress). */
function readV1(): { favorites: Record<string, number>; progress: PracticeState['progress'] } {
  const out: { favorites: Record<string, number>; progress: PracticeState['progress'] } = {
    favorites: {},
    progress: {},
  }
  try {
    const raw = localStorage.getItem('mysite.problems.v1')
    if (!raw) return out
    const s = JSON.parse(raw)?.state
    if (s?.favorites && typeof s.favorites === 'object') out.favorites = s.favorites
    if (s?.progress && typeof s.progress === 'object') {
      for (const [id, p] of Object.entries<Record<string, unknown>>(s.progress)) {
        const status = p?.status
        if (status === 'solved' || status === 'attempted') {
          out.progress[id] = { status, ts: Number(p?.ts) || Date.now() }
        }
      }
    }
  } catch {
    /* corrupted v1 state: start fresh */
  }
  return out
}

const seed = typeof window !== 'undefined' ? readV1() : { favorites: {}, progress: {} }

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set) => ({
      favorites: seed.favorites,
      progress: seed.progress,
      sessions: {},
      sessionOrder: [],

      toggleFavorite: (id) =>
        set((s) => {
          const favorites = { ...s.favorites }
          if (favorites[id]) delete favorites[id]
          else favorites[id] = Date.now()
          return { favorites }
        }),

      mark: (id, status, snap) =>
        set((s) => ({
          progress: { ...s.progress, [id]: { status, ts: Date.now(), snap } },
        })),

      clearMark: (id) =>
        set((s) => {
          const progress = { ...s.progress }
          delete progress[id]
          return { progress }
        }),

      upsertSession: (session) =>
        set((s) => {
          const sessions = { ...s.sessions, [session.sid]: session }
          let order = [session.sid, ...s.sessionOrder.filter((x) => x !== session.sid)]
          for (const drop of order.slice(MAX_SESSIONS)) delete sessions[drop]
          order = order.slice(0, MAX_SESSIONS)
          return { sessions, sessionOrder: order }
        }),

      recordAnswer: (sid, entry, cursor) =>
        set((s) => {
          const sess = s.sessions[sid]
          if (!sess) return s
          const next: PracticeSession = {
            ...sess,
            record: { ...sess.record, [entry.id]: entry },
            cursor: cursor ?? sess.cursor,
          }
          return { sessions: { ...s.sessions, [sid]: next } }
        }),

      setCursor: (sid, cursor) =>
        set((s) => {
          const sess = s.sessions[sid]
          if (!sess || sess.cursor === cursor) return s
          return { sessions: { ...s.sessions, [sid]: { ...sess, cursor } } }
        }),

      finishSession: (sid) =>
        set((s) => {
          const sess = s.sessions[sid]
          if (!sess) return s
          return {
            sessions: { ...s.sessions, [sid]: { ...sess, finishedAt: Date.now() } },
          }
        }),

      dropSession: (sid) =>
        set((s) => {
          const sessions = { ...s.sessions }
          delete sessions[sid]
          return { sessions, sessionOrder: s.sessionOrder.filter((x) => x !== sid) }
        }),
    }),
    { name: 'mysite.problems.v2' },
  ),
)

// Selector hooks (stable, avoid re-render storms).
export const useIsFavorite = (id: string) => usePracticeStore((s) => Boolean(s.favorites[id]))
export const useFavoriteCount = () => usePracticeStore((s) => Object.keys(s.favorites).length)
export const useMarkStatus = (id: string) => usePracticeStore((s) => s.progress[id]?.status)
export const useSession = (sid: string | null) =>
  usePracticeStore((s) => (sid ? s.sessions[sid] : undefined))
