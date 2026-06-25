import { Link } from 'react-router-dom'
import type { Tool } from '@/data/tools'
import { cn } from '@/lib/cn'

const iconTone: Record<string, string> = {
  gold: 'text-gold group-hover:border-gold/40',
  accent: 'text-accent group-hover:border-accent/40',
  cyan: 'text-cyan group-hover:border-cyan/40',
  neutral: 'text-fg-soft group-hover:border-border',
}
const ctaTone: Record<string, string> = {
  gold: 'text-gold',
  accent: 'text-accent',
  cyan: 'text-cyan',
  neutral: 'text-fg-soft',
}

export function ToolCard({ tool }: { tool: Tool }) {
  const tone = tool.tone ?? 'accent'
  return (
    <Link
      to={tool.path}
      className="group card flex flex-col gap-3 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-[var(--shadow-lift)]"
    >
      <span
        className={cn(
          'grid h-11 w-11 place-items-center rounded-xl border border-border-soft bg-surface-2 transition-colors',
          iconTone[tone],
        )}
      >
        <tool.Icon className="h-6 w-6" />
      </span>
      <div className="flex items-baseline gap-2">
        <h3 className="text-base font-semibold text-fg">{tool.titleZh}</h3>
        {tool.titleEn && <span className="text-xs text-faint">{tool.titleEn}</span>}
      </div>
      <p className="flex-1 text-sm leading-relaxed text-muted">{tool.description}</p>
      <span className={cn('mt-1 inline-flex items-center gap-1 text-sm font-medium', ctaTone[tone])}>
        {tool.cta}
        <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </span>
    </Link>
  )
}
