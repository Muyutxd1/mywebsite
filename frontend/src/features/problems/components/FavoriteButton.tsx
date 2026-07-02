import { cn } from '@/lib/cn'
import { useIsFavorite, usePracticeStore } from '../store/practice'

/** A star toggle wired to the localStorage favorites store. */
export function FavoriteButton({ id, className }: { id: string; className?: string }) {
  const active = useIsFavorite(id)
  const toggle = usePracticeStore((s) => s.toggleFavorite)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(id)
      }}
      aria-pressed={active}
      aria-label={active ? '取消收藏' : '收藏'}
      title={active ? '取消收藏' : '收藏'}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
        active
          ? 'border-gold/40 bg-gold/12 text-gold'
          : 'border-border-soft bg-surface-2 text-faint hover:border-gold/40 hover:text-gold',
        className,
      )}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  )
}
