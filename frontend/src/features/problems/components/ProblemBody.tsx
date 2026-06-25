import { Markdown } from '@/lib/markdown'
import { cn } from '@/lib/cn'

/**
 * Dark-token prose styling for a problem statement / solution body. Mirrors the
 * shared markdown-preview prose scale so olympiad text + KaTeX read cleanly on
 * this content-dense page.
 */
export const problemProse = cn(
  'max-w-none text-[0.95rem] leading-[1.85] text-fg-soft',
  '[&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-fg',
  '[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg',
  '[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-fg',
  '[&_p]:my-3',
  '[&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/40 [&_a:hover]:decoration-accent',
  '[&_strong]:font-semibold [&_strong]:text-fg',
  '[&_em]:text-fg',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/50 [&_blockquote]:bg-surface-2 [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:text-muted [&_blockquote]:rounded-r-lg',
  '[&_hr]:my-6 [&_hr]:border-border-soft',
  '[&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:text-cyan',
  '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border-soft [&_pre]:bg-surface-2 [&_pre]:p-4 [&_pre]:text-sm',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-fg-soft',
  '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm',
  '[&_th]:border [&_th]:border-border-soft [&_th]:bg-surface-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-fg',
  '[&_td]:border [&_td]:border-border-soft [&_td]:px-3 [&_td]:py-2',
  '[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg',
  '[&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1',
)

export function ProblemBody({ source, className }: { source: string; className?: string }) {
  return <Markdown source={source} className={cn(problemProse, className)} />
}
