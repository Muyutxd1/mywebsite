import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, useToast, ConfirmDialog } from '@/components/ui'
import { apiPost } from '@/lib/api'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { MarkdownPreview } from './components/MarkdownPreview'
import { DEMO_DOC } from './demo'
import type { ShareCreateResponse } from './types'

type Status = '就绪' | '渲染中' | '已渲染'

const PLACEHOLDER = `# 在此输入 Markdown

支持 **GFM** 语法与 LaTeX 公式，例如行内 $a^2+b^2=c^2$ 与块级：

$$
e^{i\\pi} + 1 = 0
$$

左侧编辑，右侧实时预览。`

export default function MdRenderPage() {
  const toast = useToast()
  const [source, setSource] = useState('')
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState<Status>('就绪')
  const [confirmClear, setConfirmClear] = useState(false)
  const [sharing, setSharing] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced (~120ms) live preview, matching the legacy behavior.
  useEffect(() => {
    setStatus('渲染中')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPreview(source)
      setStatus(source.trim() ? '已渲染' : '就绪')
    }, 120)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [source])

  const counts = useMemo(() => {
    const chars = source.length
    const blockCount = (source.match(/\$\$/g) || []).length / 2
    const inlineMatches = source.match(/(?<!\$)\$(?!\$)[^$\n]+?\$(?!\$)/g) || []
    const formulas = Math.floor(blockCount) + inlineMatches.length
    return { chars, formulas }
  }, [source])

  // Insert text around the current selection (or at cursor), then focus back.
  const insertAtCursor = useCallback((before: string, after: string) => {
    const el = editorRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    setSource((prev) => {
      const selected = prev.slice(start, end)
      const next = prev.slice(0, start) + before + selected + after + prev.slice(end)
      // restore cursor after React applies the new value
      requestAnimationFrame(() => {
        const pos = selected
          ? start + before.length + selected.length + after.length
          : start + before.length
        el.focus()
        el.setSelectionRange(pos, pos)
      })
      return next
    })
  }, [])

  const handleDemo = useCallback(() => {
    setSource(DEMO_DOC)
    editorRef.current?.focus()
    toast('📋 已填入示例文档')
  }, [toast])

  const handleClear = useCallback(() => {
    if (source) {
      setConfirmClear(true)
    } else {
      editorRef.current?.focus()
    }
  }, [source])

  const doClear = useCallback(() => {
    setSource('')
    setConfirmClear(false)
    editorRef.current?.focus()
    toast('🗑 已清空')
  }, [toast])

  const handleShare = useCallback(async () => {
    const content = source.trim()
    if (!content) {
      toast('⚠️ 内容为空，无法分享', 'danger')
      return
    }
    setSharing(true)
    setStatus('渲染中')
    try {
      const data = await apiPost<ShareCreateResponse>('/api/mdrender/share', { content })
      const fullUrl = window.location.origin + data.url
      try {
        await navigator.clipboard.writeText(fullUrl)
        toast('🔗 分享链接已复制到剪贴板', 'success')
      } catch {
        toast('🔗 ' + fullUrl, 'success')
      }
      setStatus('已渲染')
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '未知错误'
      toast('❌ 分享失败：' + msg, 'danger')
      setStatus('已渲染')
    } finally {
      setSharing(false)
    }
  }, [source, toast])

  const handleExport = useCallback(async () => {
    const node = previewRef.current
    if (!node || !source.trim()) {
      toast('⚠️ 预览区域为空，无法导出', 'danger')
      return
    }
    toast('⏳ 正在导出图片…')
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(node, {
        backgroundColor: getComputedStyle(document.body).backgroundColor || '#0b0d14',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      canvas.toBlob((blob) => {
        if (!blob) {
          toast('❌ 导出失败', 'danger')
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'markdown-export.png'
        a.click()
        URL.revokeObjectURL(url)
        toast('🖼 图片已下载', 'success')
      }, 'image/png')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast('❌ 导出失败：' + msg, 'danger')
    }
  }, [source, toast])

  // Keyboard: Ctrl/Cmd+S share, Tab=2 spaces, Ctrl/Cmd+B bold, Ctrl/Cmd+I italic.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleShare()
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        insertAtCursor('  ', '')
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        insertAtCursor('**', '**')
      } else if (mod && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        insertAtCursor('*', '*')
      }
    },
    [handleShare, insertAtCursor],
  )

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-[1400px] flex-col px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-4 shrink-0">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.25em] text-accent/80">
          MARKDOWN · LATEX
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">实时渲染器</h1>
        <p className="mt-1 text-sm text-muted">
          左侧输入 Markdown 与 LaTeX 公式，右侧即时预览，可导出图片或生成分享链接。
        </p>
      </header>

      {/* Toolbar */}
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={handleDemo}>
          示例
        </Button>
        <Button size="sm" variant="secondary" onClick={handleClear}>
          清空
        </Button>
        <span className="mx-1 hidden h-5 w-px bg-border-soft sm:block" />
        <Button size="sm" variant="ghost" onClick={() => insertAtCursor('$', '$')}>
          行内公式
        </Button>
        <Button size="sm" variant="ghost" onClick={() => insertAtCursor('$$\n', '\n$$')}>
          块级公式
        </Button>
        <span className="mx-1 hidden h-5 w-px bg-border-soft sm:block" />
        <Button size="sm" variant="outline" onClick={handleExport}>
          导出图片
        </Button>
        <Button size="sm" variant="primary" onClick={handleShare} disabled={sharing}>
          {sharing ? '生成中…' : '分享'}
        </Button>
      </div>

      {/* Split editor / preview */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        {/* Editor */}
        <div className="card flex min-h-[40vh] flex-col overflow-hidden p-0 md:min-h-0">
          <div className="flex items-center justify-between border-b border-border-soft px-3 py-2 text-xs text-muted">
            <span>编辑 · Markdown 源码</span>
          </div>
          <textarea
            ref={editorRef}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            placeholder={PLACEHOLDER}
            className={cn(
              'min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-fg',
              'outline-none placeholder:text-faint',
            )}
          />
        </div>

        {/* Preview */}
        <div className="card flex min-h-[40vh] flex-col overflow-hidden p-0 md:min-h-0">
          <div className="flex items-center justify-between border-b border-border-soft px-3 py-2 text-xs text-muted">
            <span>预览</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {preview.trim() ? (
              <MarkdownPreview ref={previewRef} source={preview} />
            ) : (
              <p className="py-16 text-center text-sm text-faint">
                预览区域 · 左侧输入 Markdown 即可实时看到效果
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="mt-3 flex shrink-0 items-center justify-end gap-3 text-xs text-muted">
        <span>
          {counts.chars.toLocaleString()} 字 · {counts.formulas} 公式
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
            status === '渲染中' && 'text-warning',
            status === '已渲染' && 'text-success',
            status === '就绪' && 'text-faint',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              status === '渲染中' && 'bg-warning',
              status === '已渲染' && 'bg-success',
              status === '就绪' && 'bg-border',
            )}
          />
          {status}
        </span>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="清空编辑器"
        message="确定要清空编辑器内容吗？此操作无法撤销。"
        confirmLabel="清空"
        cancelLabel="取消"
        danger
        onConfirm={doClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
