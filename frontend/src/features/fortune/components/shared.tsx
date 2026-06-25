import type { ReactNode } from 'react'
import { Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Hexagram } from '../types'

// ── 五行 → token color class ──────────────────────────────
export const WUXING_TEXT: Record<string, string> = {
  木: 'text-wuxing-mu',
  火: 'text-wuxing-huo',
  土: 'text-wuxing-tu',
  金: 'text-wuxing-jin',
  水: 'text-wuxing-shui',
}
export const WUXING_BG: Record<string, string> = {
  木: 'bg-wuxing-mu',
  火: 'bg-wuxing-huo',
  土: 'bg-wuxing-tu',
  金: 'bg-wuxing-jin',
  水: 'bg-wuxing-shui',
}

// ── 占星元素 → token color class ──────────────────────────────
export const ELEM_TEXT: Record<string, string> = {
  火: 'text-elem-fire',
  土: 'text-elem-earth',
  风: 'text-elem-air',
  水: 'text-elem-water',
}
export const ELEM_BORDER: Record<string, string> = {
  火: 'border-elem-fire/40',
  土: 'border-elem-earth/40',
  风: 'border-elem-air/40',
  水: 'border-elem-water/40',
}

// ── 体用吉凶 → verdict ramp ──────────────────────────────
type Verdict = 'good' | 'ok' | 'flat' | 'warn' | 'bad'
export function fortuneVerdict(f: string): Verdict {
  return (
    {
      吉: 'good',
      小吉: 'ok',
      平: 'flat',
      小凶: 'warn',
      凶: 'bad',
    } as Record<string, Verdict>
  )[f] ?? 'flat'
}
export const VERDICT_TEXT: Record<Verdict, string> = {
  good: 'text-verdict-good',
  ok: 'text-verdict-ok',
  flat: 'text-verdict-flat',
  warn: 'text-verdict-warn',
  bad: 'text-verdict-bad',
}
export const VERDICT_BORDER: Record<Verdict, string> = {
  good: 'border-verdict-good/35 bg-verdict-good/8',
  ok: 'border-verdict-ok/35 bg-verdict-ok/8',
  flat: 'border-verdict-flat/35 bg-verdict-flat/8',
  warn: 'border-verdict-warn/35 bg-verdict-warn/8',
  bad: 'border-verdict-bad/35 bg-verdict-bad/8',
}

// ── small chip ──────────────────────────────
export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'gold' | 'accent' | 'cyan'
  className?: string
}) {
  const tones = {
    neutral: 'border-border-soft bg-surface-2 text-muted',
    gold: 'border-gold/30 bg-gold/10 text-gold',
    accent: 'border-accent/30 bg-accent/10 text-accent',
    cyan: 'border-cyan/30 bg-cyan/10 text-cyan',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// ── 卦 tag (本/互/变) ──────────────────────────────
export function GuaTag({ gua, label }: { gua: Hexagram | null | undefined; label: string }) {
  if (!gua) return null
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-center">
      <span className="text-[10px] uppercase tracking-widest text-faint">{label}</span>
      <span className="text-sm font-semibold text-fg">{gua.name}</span>
      <span className="text-base leading-none text-gold">
        {(gua.upper_symbol || '') + (gua.lower_symbol || '')}
      </span>
    </div>
  )
}

// ── 五行 bars 木火土金水 ──────────────────────────────
const WUXING_ORDER = ['木', '火', '土', '金', '水'] as const
export function WuxingBars({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  return (
    <div className="space-y-2">
      {WUXING_ORDER.map((wx) => {
        const c = counts[wx] || 0
        const pct = Math.round((c / total) * 100)
        return (
          <div key={wx} className="flex items-center gap-3">
            <span className={cn('w-5 text-sm font-semibold', WUXING_TEXT[wx])}>{wx}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn('h-full rounded-full transition-all', WUXING_BG[wx])}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-right text-xs tabular-nums text-muted">{c}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── loading / error / lead ──────────────────────────────
export function FortuneLoading() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-border-soft bg-surface py-12 text-muted">
      <Spinner size={20} />
      <span className="text-sm">正在推演…</span>
    </div>
  )
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted">{children}</p>
}

export function FortuneFooter() {
  return (
    <p className="mt-8 text-center text-xs text-faint">
      仅供娱乐参考 · 命运的笔，始终握在你自己手里
    </p>
  )
}
