import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import type { ReadingBlock } from '../types'

/**
 * Parse the backend's long「【标题】正文…」interpretation string into clean blocks.
 * Mirrors the legacy parseSections(): a line `【标题】rest` opens a section;
 * other non-empty lines become paragraphs of the current section.
 */
export function parseSections(text: string): ReadingBlock[] {
  const blocks: ReadingBlock[] = []
  let cur: ReadingBlock | null = null
  for (const raw of String(text || '').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    const m = line.match(/^【(.+?)】(.*)$/)
    if (m) {
      cur = { title: m[1], lines: [] }
      blocks.push(cur)
      if (m[2].trim()) cur.lines.push(m[2].trim())
    } else if (line.trim()) {
      if (!cur) {
        cur = { title: '', lines: [] }
        blocks.push(cur)
      }
      cur.lines.push(line.trim())
    }
  }
  return blocks
}

const NOTE_RE = /^[✨💫🔮]/
// Decorative divider lines made of repeated rule glyphs — render as a hairline.
const DIVIDER_RE = /^[─—━=]{4,}$/

export function ReadingRenderer({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseSections(text), [text])
  if (!blocks.length) return null

  return (
    <div className={cn('mt-6 space-y-6', className)}>
      {blocks.map((b, bi) => (
        <section key={bi} className="space-y-2">
          {b.title && (
            <h4 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-gold">
              <span className="h-3.5 w-0.5 rounded-full bg-gold/70" aria-hidden />
              {b.title}
            </h4>
          )}
          {b.lines.map((ln, li) => {
            if (DIVIDER_RE.test(ln)) {
              return <hr key={li} className="my-3 border-t border-border-soft" />
            }
            const note = NOTE_RE.test(ln)
            return (
              <p
                key={li}
                className={cn(
                  'text-sm leading-relaxed',
                  note
                    ? 'rounded-lg border border-gold/25 bg-gold/8 px-3 py-2 text-gold'
                    : 'text-fg-soft',
                )}
              >
                {ln}
              </p>
            )
          })}
        </section>
      ))}
    </div>
  )
}
