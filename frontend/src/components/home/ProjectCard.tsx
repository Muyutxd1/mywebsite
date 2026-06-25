import { Link } from 'react-router-dom'
import type { Tool, ProjectExtra } from '@/data/tools'
import { Badge } from '@/components/ui/Badge'

export function ProjectCard({ tool, extra }: { tool?: Tool; extra?: ProjectExtra }) {
  if (tool) {
    return (
      <Link
        to={tool.path}
        className="group card flex flex-col gap-3 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-[var(--shadow-lift)]"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-border-soft bg-surface-2 text-accent">
          <tool.Icon className="h-5 w-5" />
        </span>
        <h3 className="font-semibold text-fg">{tool.titleZh}</h3>
        <p className="flex-1 text-sm leading-relaxed text-muted">{tool.description}</p>
        <span className="text-xs text-faint">Web · 在线工具</span>
      </Link>
    )
  }
  if (extra) {
    return (
      <div className="card flex flex-col gap-3 p-5">
        <h3 className="font-semibold text-fg">{extra.title}</h3>
        <p className="flex-1 text-sm leading-relaxed text-muted">{extra.description}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-faint">{extra.techStack}</span>
          {extra.desktopOnly ? (
            <Badge tone="neutral">桌面应用</Badge>
          ) : (
            extra.href && (
              <a href={extra.href} className="text-sm font-medium text-accent">
                {extra.cta ?? '前往'} →
              </a>
            )
          )}
        </div>
      </div>
    )
  }
  return null
}
