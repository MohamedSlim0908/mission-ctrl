import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 5000,
      staleTime: 2000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0f0f1a',
            color: '#e2e8f0',
            border: '1px solid rgba(0, 255, 136, 0.2)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
          },
          success: {
            iconTheme: { primary: '#00ff88', secondary: '#0f0f1a' },
          },
          error: {
            iconTheme: { primary: '#ff4444', secondary: '#0f0f1a' },
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
)
