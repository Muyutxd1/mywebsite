import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Spinner({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-full border-2 border-border border-t-accent', className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}

export function PageLoader({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-muted">
      <Spinner size={32} />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({
  title = '暂无内容',
  description,
  icon,
  action,
}: {
  title?: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-soft py-14 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <p className="font-medium text-fg-soft">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({
  title = '出错了',
  description = '请稍后重试。',
  onRetry,
}: {
  title?: string
  description?: ReactNode
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/30 bg-danger/5 py-12 text-center">
      <p className="font-medium text-danger">{title}</p>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-fg-soft hover:border-accent hover:text-fg"
        >
          重试
        </button>
      )}
    </div>
  )
}
