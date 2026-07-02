import { cn } from '@/lib/cn'
import type { ProblemLang } from '../store/prefs'

/**
 * 中文 | 原文 segment toggle. `hasZh=false` pins it to EN with a hint chip.
 * Controlled: the owner decides whether the choice is per-problem or global.
 */
export function LangToggle({
  value,
  hasZh,
  onChange,
  className,
}: {
  value: ProblemLang
  hasZh: boolean
  onChange: (lang: ProblemLang) => void
  className?: string
}) {
  if (!hasZh) {
    return (
      <span
        className={cn(
          'inline-flex h-8 items-center rounded-lg border border-border-soft bg-surface-2 px-2.5 text-xs text-muted',
          className,
        )}
        title="本题暂无中文翻译"
      >
        暂无中文
      </span>
    )
  }
  const seg = (lang: ProblemLang, label: string) => (
    <button
      type="button"
      onClick={() => onChange(lang)}
      aria-pressed={value === lang}
      className={cn(
        'h-full rounded-md px-2.5 text-xs font-medium transition-colors',
        value === lang ? 'bg-accent text-accent-fg' : 'text-fg-soft hover:text-fg',
      )}
    >
      {label}
    </button>
  )
  return (
    <div
      className={cn(
        'inline-flex h-8 items-center gap-0.5 rounded-lg border border-border-soft bg-surface-2 p-0.5',
        className,
      )}
    >
      {seg('zh', '中文')}
      {seg('en', '原文')}
    </div>
  )
}
