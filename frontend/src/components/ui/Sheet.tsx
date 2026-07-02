import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Bottom sheet on mobile, right-side panel on `sm+`. Portal + ESC + scroll
 * lock, mirroring Modal's behavior so the two feel like one system.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_.15s_ease-out]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute flex flex-col overflow-hidden bg-surface shadow-2xl',
          // mobile: bottom sheet
          'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-border-soft',
          'animate-[sheetUp_.25s_var(--ease-out)]',
          // sm+: right-side panel
          'sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[400px] sm:max-h-none sm:rounded-none sm:border-l sm:border-t-0',
          'sm:animate-[sheetIn_.25s_var(--ease-out)]',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-3.5">
          <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden />
          {title && <div className="hidden text-base font-semibold sm:block">{title}</div>}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg sm:inline-flex"
          >
            ✕
          </button>
        </div>
        {title && (
          <div className="border-b border-border-soft px-5 py-2.5 text-base font-semibold sm:hidden">{title}</div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-border-soft px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
