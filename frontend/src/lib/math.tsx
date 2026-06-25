import katex from 'katex'
import { useMemo } from 'react'

/** Render a single TeX string to KaTeX HTML (never throws). */
export function renderTeX(tex: string, displayMode = false): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: 'html',
    })
  } catch {
    return escapeHtml(tex)
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Render a string that may interleave prose with inline `$...$` math.
 * Non-`$` text stays literal (escaped); only `$`-delimited spans go to KaTeX.
 * This mirrors the legacy knowledge/factorize inline renderers.
 */
export function MathText({ children, className }: { children: string; className?: string }) {
  const html = useMemo(() => {
    const src = children ?? ''
    return src
      .split(/(\$[^$]+\$)/g)
      .map((part) =>
        part.length > 2 && part.startsWith('$') && part.endsWith('$')
          ? renderTeX(part.slice(1, -1), false)
          : escapeHtml(part),
      )
      .join('')
  }, [children])
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

/** Display-mode formula. */
export function MathBlock({ tex, className }: { tex: string; className?: string }) {
  const html = useMemo(() => renderTeX(tex, true), [tex])
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
