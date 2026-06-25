import { Link } from 'react-router-dom'
import { toolsBySlug } from '@/data/tools'

/** Intentional placeholder for routes whose feature page is not yet rebuilt. */
export function ComingSoon({
  slug,
  title,
  description,
}: {
  slug?: string
  title?: string
  description?: string
}) {
  const tool = slug ? toolsBySlug[slug] : undefined
  const heading = title ?? tool?.titleZh ?? '建设中'
  const desc = description ?? tool?.description ?? '这个页面正在重写中。'
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      {tool && (
        <span className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-border-soft bg-surface-2 text-accent">
          <tool.Icon className="h-8 w-8" />
        </span>
      )}
      <h1 className="text-2xl font-bold text-fg">{heading}</h1>
      <p className="mx-auto mt-3 max-w-sm text-muted">{desc}</p>
      <p className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-sm text-accent">
        ✦ 正在重写中
      </p>
      <div className="mt-8">
        <Link to="/" className="text-sm text-muted transition-colors hover:text-fg">
          ← 返回首页
        </Link>
      </div>
    </div>
  )
}
