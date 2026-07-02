import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { countResults, sessionEntries, sessionToQuery } from '../lib/session'
import { usePracticeStore, type PracticeSession } from '../store/practice'

function SessionRow({ session }: { session: PracticeSession }) {
  const drop = usePracticeStore((s) => s.dropSession)
  const counts = countResults(sessionEntries(session))
  const done = Boolean(session.finishedAt)
  const url = `/problems/practice/run?${sessionToQuery({
    f: session.f, mode: session.mode, seed: session.seed, n: session.n, sid: session.sid,
  })}`

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-soft bg-surface p-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{session.label}</p>
        <p className="mt-0.5 text-xs text-muted">
          {new Date(session.startedAt).toLocaleDateString()} ·{' '}
          {done ? '已完成' : `进行到 ${Math.min(session.cursor + 1, session.ids.length)}/${session.ids.length}`} · 会做{' '}
          {counts.solved}/{counts.total}
        </p>
      </div>
      <Link
        to={url}
        className={cn(
          'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
          done
            ? 'border-border-soft text-fg-soft hover:border-accent/40 hover:text-fg'
            : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20',
        )}
      >
        {done ? '查看' : '继续'}
      </Link>
      <button
        type="button"
        onClick={() => drop(session.sid)}
        aria-label="删除记录"
        className="shrink-0 rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-danger"
      >
        ✕
      </button>
    </div>
  )
}

/** Recent practice sessions (LRU-capped in the store). */
export function PracticeHistoryList() {
  const order = usePracticeStore((s) => s.sessionOrder)
  const sessions = usePracticeStore((s) => s.sessions)
  const list = order.map((sid) => sessions[sid]).filter(Boolean)

  if (list.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-soft bg-surface-2 px-4 py-6 text-center text-sm text-muted">
        还没有练习记录——从上方选一个集合开始刷题
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {list.map((s) => (
        <SessionRow key={s.sid} session={s} />
      ))}
    </div>
  )
}
