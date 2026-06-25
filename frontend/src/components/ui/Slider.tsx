import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  valueLabel?: string
}

export function Slider({ label, valueLabel, className, ...props }: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      {(label || valueLabel) && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{label}</span>
          <span className="font-mono text-fg-soft">{valueLabel}</span>
        </div>
      )}
      <input
        type="range"
        className={cn('h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--color-accent)]', className)}
        {...props}
      />
    </div>
  )
}
