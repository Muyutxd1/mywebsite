import { useState } from 'react'
import { cn } from '@/lib/cn'
import { CompetitionCard, CompetitionRow } from './CompetitionCard'
import type { RegionGroup } from '../types'

/**
 * The region-sectioned competition directory. tier 1–2 render as cards;
 * tier 3–4 (HMMT, training sets, *_other) collapse into a「更多赛事」row so
 * mega-competitions never flood the page.
 */
export function RegistryDirectory({ regions }: { regions: RegionGroup[] }) {
  return (
    <div className="space-y-8">
      {regions.map((region) => (
        <RegionSection key={region.key} region={region} />
      ))}
    </div>
  )
}

function RegionSection({ region }: { region: RegionGroup }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const cards = region.competitions.filter((c) => c.tier <= 2)
  const rest = region.competitions.filter((c) => c.tier >= 3)

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-fg">{region.zh}</h2>
        <span className="text-xs text-muted">{region.count} 题</span>
      </div>
      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <CompetitionCard key={c.comp_key} comp={c} />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className={cn('rounded-xl border border-border-soft', cards.length > 0 && 'mt-3')}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-fg-soft transition-colors hover:text-fg"
          >
            <span>
              更多赛事（{rest.length} 项 · {rest.reduce((s, c) => s + c.count, 0)} 题）
            </span>
            <svg
              className={cn('transition-transform duration-200', moreOpen && 'rotate-180')}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {moreOpen && (
            <div className="grid gap-0.5 border-t border-border-soft p-1.5 sm:grid-cols-2">
              {rest.map((c) => (
                <CompetitionRow key={c.comp_key} comp={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
