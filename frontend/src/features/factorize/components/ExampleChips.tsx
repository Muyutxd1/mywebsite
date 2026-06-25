import type { ExampleChip } from '../types'

/** Example expressions; clicking a chip fills the input AND submits. */
export const EXAMPLES: ExampleChip[] = [
  { label: 'x²-1', expr: 'x^2 - 1' },
  { label: 'x²-5x+6', expr: 'x^2 - 5x + 6' },
  { label: 'x³-8', expr: 'x^3 - 8' },
  { label: 'a²-b²', expr: 'a^2 - b^2' },
  { label: 'a³-b³', expr: 'a^3 - b^3' },
  { label: 'x⁴-1', expr: 'x^4 - 1' },
  { label: 'x²+7x+12', expr: 'x^2 + 7x + 12' },
  { label: '2x²+5x-3', expr: '2x^2 + 5x - 3' },
  { label: '2x²+7x+3', expr: '2x^2 + 7x + 3' },
  { label: 'x²+4x+4', expr: 'x^2 + 4x + 4' },
]

export function ExampleChips({ onPick }: { onPick: (expr: string) => void }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {EXAMPLES.map((ex) => (
        <button
          key={ex.expr}
          type="button"
          title={ex.expr}
          onClick={() => onPick(ex.expr)}
          className="rounded-full border border-border-soft bg-surface-2 px-3.5 py-1.5 font-mono text-sm text-fg-soft transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent active:scale-[0.97]"
        >
          {ex.label}
        </button>
      ))}
    </div>
  )
}
