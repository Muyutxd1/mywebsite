import { cn } from '@/lib/cn'
import type { MbtiOption } from './types'

/** 5 Likert emoji+label buttons; the selected one is highlighted. */
export function LikertOptions({
  options,
  optionEmoji,
  selected,
  onSelect,
}: {
  options: MbtiOption[]
  optionEmoji: string[]
  selected: number | undefined
  onSelect: (value: number) => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
      {options.map((opt) => {
        const isActive = selected === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            aria-pressed={isActive}
            className={cn(
              'flex min-w-[88px] flex-1 basis-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all duration-200 active:scale-[0.97] sm:min-w-[104px] sm:max-w-[140px]',
              isActive
                ? 'border-accent bg-accent/12 text-fg shadow-[var(--shadow-glow)]'
                : 'border-border-soft bg-surface-2 text-fg-soft hover:border-border hover:bg-surface-3',
            )}
          >
            <span className="text-2xl leading-none sm:text-[26px]" aria-hidden>
              {optionEmoji[opt.value] ?? '🤔'}
            </span>
            <span className={cn('text-[11px]', isActive ? 'font-medium text-accent' : 'text-muted')}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
