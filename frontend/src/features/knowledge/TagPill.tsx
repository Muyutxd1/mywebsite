import { cn } from '@/lib/cn'

/**
 * Color a tag by its "level" semantics, mirroring the legacy legend:
 *   核心/基础/概念/定理 → accent (core/foundation)
 *   进阶/中级           → warning (intermediate)
 *   视野拓展            → success (horizon)
 *   竞赛高频            → danger  (high-frequency)
 *   方法/工具/恒等式/猜想/元学习/经典 → cyan / neutral fallbacks
 */
type ToneKey = 'accent' | 'warning' | 'success' | 'danger' | 'cyan' | 'neutral'

const toneClass: Record<ToneKey, string> = {
  accent: 'bg-accent/12 text-accent border-accent/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  success: 'bg-success/12 text-success border-success/25',
  danger: 'bg-danger/12 text-danger border-danger/25',
  cyan: 'bg-cyan/12 text-cyan border-cyan/25',
  neutral: 'bg-surface-2 text-muted border-border-soft',
}

function toneFor(tag: string): ToneKey {
  if (tag.includes('竞赛')) return 'danger'
  if (tag.includes('视野') || tag.includes('拓展')) return 'success'
  if (tag.includes('进阶') || tag.includes('中级')) return 'warning'
  if (tag.includes('核心') || tag.includes('基础') || tag.includes('概念') || tag.includes('定理'))
    return 'accent'
  if (tag.includes('方法') || tag.includes('工具') || tag.includes('恒等式')) return 'cyan'
  return 'neutral'
}

export function TagPill({ tag }: { tag: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none',
        toneClass[toneFor(tag)],
      )}
    >
      {tag}
    </span>
  )
}
