import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useMemo } from 'react'
import { renderTeX } from './math'

marked.setOptions({ gfm: true, breaks: true })

/**
 * Canonical Markdown + LaTeX pipeline shared by the editor preview, share page,
 * and the problem-bank detail view, so they all render identically.
 *
 * Order (protect → render math → parse markdown → restore → sanitize):
 *   1. stash fenced ```code``` and `inline code` so $ inside them is untouched
 *   2. render $$block$$ then $inline$ math to KaTeX HTML, stashed as tokens
 *   3. restore code, run marked
 *   4. restore math tokens, DOMPurify-sanitize (XSS-safe for shared content)
 */
export function renderMarkdown(src: string): string {
  if (!src) return ''
  let s = src

  const fenced: string[] = []
  s = s.replace(/```[\s\S]*?```/g, (m) => {
    fenced.push(m)
    return `@@FENCE${fenced.length - 1}@@`
  })

  const inlineCode: string[] = []
  s = s.replace(/`[^`\n]+`/g, (m) => {
    inlineCode.push(m)
    return `@@CODE${inlineCode.length - 1}@@`
  })

  const math: string[] = []
  const stashMath = (html: string) => {
    math.push(html)
    return `@@MJX${math.length - 1}@@`
  }
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => stashMath(renderTeX(tex.trim(), true)))
  s = s.replace(/\$([^$\n]+?)\$/g, (_m, tex: string) => stashMath(renderTeX(tex, false)))

  s = s.replace(/@@CODE(\d+)@@/g, (_m, i: string) => inlineCode[+i])
  s = s.replace(/@@FENCE(\d+)@@/g, (_m, i: string) => fenced[+i])

  let html = marked.parse(s) as string
  html = html.replace(/@@MJX(\d+)@@/g, (_m, i: string) => math[+i])

  return DOMPurify.sanitize(html, { ADD_ATTR: ['style'] })
}

export function useMarkdown(src: string): string {
  return useMemo(() => renderMarkdown(src), [src])
}

/** Drop-in rendered Markdown block. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMarkdown(source)
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
