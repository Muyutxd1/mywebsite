import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Clear every client-side cache (SW + Cache API + storage) then hard-reload. */
async function purgeAndReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    /* ignore */
  }
  location.reload()
}

/**
 * Top-level error boundary. Without it, any thrown error during render unmounts
 * the React tree to a blank white screen ("闪一下就没了"). This catches it,
 * surfaces the real error, and offers recovery — including purging a stale
 * Service Worker / cache that a previous project on this origin may have left.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#0a0b12',
          color: '#edeef4',
          fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
        }}
      >
        <div style={{ maxWidth: 560, width: '100%' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.25em', color: '#8b7bff', margin: 0 }}>
            出错了 · SOMETHING BROKE
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 4px' }}>页面渲染出错</h1>
          <p style={{ color: '#969cb0', margin: '0 0 16px', lineHeight: 1.7 }}>
            页面崩溃了。多数情况下是浏览器扩展或旧缓存/Service Worker 导致的；点下方「清除缓存并重载」通常能解决。
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => location.reload()} style={btn(false)}>
              重新加载
            </button>
            <button onClick={() => void purgeAndReload()} style={btn(true)}>
              清除缓存并重载
            </button>
          </div>
          <details style={{ marginTop: 18 }}>
            <summary style={{ cursor: 'pointer', color: '#969cb0', fontSize: 13 }}>
              错误详情（截图发我）
            </summary>
            <pre
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                background: '#14161f',
                border: '1px solid #20242f',
                color: '#c9cdda',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 280,
                overflow: 'auto',
              }}
            >
              {error.name}: {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}

function btn(primary: boolean): React.CSSProperties {
  return {
    height: 44,
    padding: '0 20px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    border: primary ? 'none' : '1px solid #2a2f3e',
    background: primary ? '#6f5cff' : '#1b1e29',
    color: primary ? '#fff' : '#edeef4',
  }
}
