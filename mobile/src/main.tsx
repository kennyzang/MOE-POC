import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/lib/i18n'
import '@/styles/global.css'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)

// Register Service Worker (vite-plugin-pwa auto-generates this)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // vite-plugin-pwa registers sw automatically with registerType: 'autoUpdate'
    // This listener handles update notifications
    navigator.serviceWorker.ready.then(registration => {
      console.log('[SW] Service Worker registered, scope:', registration.scope)
    }).catch(err => {
      console.warn('[SW] Registration check failed:', err)
    })
  })
}
