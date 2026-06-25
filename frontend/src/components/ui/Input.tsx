import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const base =
  'w-full rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-fg placeholder:text-faint outline-none transition-colors focus:border-accent focus:bg-surface-3'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, 'py-2 leading-relaxed', className)} {...props} />
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      {children}
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  )
}
