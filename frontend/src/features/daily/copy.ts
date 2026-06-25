import type { Quote } from './types'

/** Build the shareable text: '"text"\n—— source · author' (legacy format). */
export function formatQuote(q: Quote): string {
  const tail = `${q.source || ''}${q.author ? ` · ${q.author}` : ''}`.trim()
  return `"${q.text}"${tail ? `\n—— ${tail}` : ''}`
}

/** Copy to clipboard with a non-HTTPS (execCommand) fallback. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to legacy fallback
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
