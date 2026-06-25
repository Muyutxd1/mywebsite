import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Modal({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'card relative z-10 w-full max-w-md overflow-hidden p-0 animate-[modalIn_.2s_var(--ease-out)]',
          className,
        )}
      >
        {title && <div className="border-b border-border-soft px-5 py-4 text-base font-semibold">{title}</div>}
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border-soft px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Promise-free confirm dialog built on Modal. */
export function ConfirmDialog({
  open,
  title = '确认操作',
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title?: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-fg-soft hover:bg-surface-2"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium text-white',
              danger ? 'bg-danger hover:opacity-90' : 'bg-accent hover:bg-accent-strong',
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-fg-soft">{message}</p>
    </Modal>
  )
}
