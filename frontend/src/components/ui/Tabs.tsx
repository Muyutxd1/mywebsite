import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-xl border border-border-soft bg-surface p-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all',
            value === t.value
              ? 'bg-accent text-accent-fg shadow-[var(--shadow-glow)]'
              : 'text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
