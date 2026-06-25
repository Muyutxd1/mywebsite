import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'gold'
  | 'cyan'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-muted border-border-soft',
  accent: 'bg-accent/12 text-accent border-accent/25',
  gold: 'bg-gold/12 text-gold border-gold/25',
  cyan: 'bg-cyan/12 text-cyan border-cyan/25',
  success: 'bg-success/12 text-success border-success/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  danger: 'bg-danger/12 text-danger border-danger/25',
  info: 'bg-info/12 text-info border-info/25',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
