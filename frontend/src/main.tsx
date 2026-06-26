import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import 'katex/dist/katex.min.css'
import './index.css'
import { queryClient } from '@/lib/queryClient'
import { AppRouter } from '@/app/router'
import { ToastProvider } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/app/ErrorBoundary'

// This SPA ships no service worker. Defensively unregister any stale SW left by
// a different project previously served on this origin (a common cause of a
// "flash then white screen" when an old cached shell hijacks fetches).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
