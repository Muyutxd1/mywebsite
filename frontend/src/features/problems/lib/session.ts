import { EMPTY_FILTERS, parseFilters, type ProblemFilters } from '../api/filters'
import type { PracticeSession, RecordResult, SessionRecordEntry } from '../store/practice'

/** The practice-run URL carries the whole session skeleton: f/mode/seed/n/sk/sid. */
export interface SessionParams {
  f: string
  mode: 'seq' | 'random'
  seed: number
  n: number
  /** skip-solved was applied when the id list was resolved */
  sk: boolean
  sid: string
}

export function newSid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function newSeed(): number {
  return (Math.floor(Math.random() * 900000) + 100000) | 0
}

/** Deterministic Fisher–Yates over a 31-bit LCG — same seed, same order,
 *  shared by session creation and URL-only session rebuild. */
export function seededShuffle(ids: string[], seed: number): string[] {
  let s = seed || 1
  const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x80000000)
  const out = [...ids]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function sessionToQuery(p: SessionParams): string {
  const sp = new URLSearchParams()
  if (p.f) sp.set('f', p.f)
  sp.set('mode', p.mode)
  if (p.mode === 'random') sp.set('seed', String(p.seed))
  if (p.n) sp.set('n', String(p.n))
  if (p.sk) sp.set('sk', '1')
  sp.set('sid', p.sid)
  return sp.toString()
}

export function sessionFromQuery(sp: URLSearchParams): SessionParams | null {
  const sid = sp.get('sid')
  if (!sid) return null
  const mode = sp.get('mode') === 'random' ? 'random' : 'seq'
  return {
    f: sp.get('f') || '',
    mode,
    seed: parseInt(sp.get('seed') || '0', 10) || 0,
    n: parseInt(sp.get('n') || '0', 10) || 0,
    sk: sp.get('sk') === '1',
    sid,
  }
}

/** `f` is either a filters query string or an explicit `ids:` review set. */
export function isIdSet(f: string): boolean {
  return f.startsWith('ids:')
}

export function idSetIds(f: string): string[] {
  return f.slice(4).split(',').filter(Boolean)
}

export function filtersFromF(f: string): ProblemFilters {
  if (isIdSet(f)) return { ...EMPTY_FILTERS }
  return parseFilters(new URLSearchParams(f))
}

// ---------------------------------------------------------------------------
// Stats aggregation (pure, over session records / global progress)
// ---------------------------------------------------------------------------
export interface ResultCounts {
  solved: number
  attempted: number
  failed: number
  skipped: number
  total: number
}

export function countResults(entries: SessionRecordEntry[]): ResultCounts {
  const c: ResultCounts = { solved: 0, attempted: 0, failed: 0, skipped: 0, total: entries.length }
  for (const e of entries) c[e.result as RecordResult]++
  return c
}

export function groupResults(
  entries: SessionRecordEntry[],
  by: (e: SessionRecordEntry) => string | null | undefined,
): { key: string; counts: ResultCounts }[] {
  const groups = new Map<string, SessionRecordEntry[]>()
  for (const e of entries) {
    const k = by(e) || '未知'
    const arr = groups.get(k) ?? []
    arr.push(e)
    groups.set(k, arr)
  }
  return [...groups.entries()]
    .map(([key, arr]) => ({ key, counts: countResults(arr) }))
    .sort((a, b) => b.counts.total - a.counts.total)
}

export function sessionEntries(s: PracticeSession): SessionRecordEntry[] {
  return Object.values(s.record)
}

export function sessionDurationMs(s: PracticeSession): number {
  return (s.finishedAt ?? Date.now()) - s.startedAt
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 1) return '不到 1 分钟'
  if (min < 60) return `${min} 分钟`
  return `${Math.floor(min / 60)} 小时 ${min % 60} 分`
}
