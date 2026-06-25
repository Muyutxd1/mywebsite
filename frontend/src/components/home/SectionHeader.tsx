import type { ReactNode } from 'react'

export function SectionHeader({
  label,
  title,
  description,
}: {
  label?: string
  title: ReactNode
  description?: ReactNode
}) {
  return (
    <div className="mb-8">
      {label && (
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">{label}</p>
      )}
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-muted">{description}</p>}
    </div>
  )
}
