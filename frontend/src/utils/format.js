export function formatRuntime(ms) {
  if (!ms || ms <= 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  const mrem = m % 60
  return `${h}h ${mrem}m`
}

export function formatTokens(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n/1000).toFixed(1)}k`
  return String(n)
}

export function formatDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('en-US', { 
    month: 'short', day: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

export function formatTimeAgo(ts) {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const s = Math.round(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h/24)}d ago`
}

export function getStatusColor(status) {
  switch (status) {
    case 'running': return 'neon-green'
    case 'completed': return 'neon-blue'
    case 'failed': return 'neon-red'
    case 'pending': return 'neon-yellow'
    case 'idle': return 'gray'
    default: return 'gray'
  }
}

export function getStatusBgClass(status) {
  switch (status) {
    case 'running': return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'idle': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

export function getStatusDotColor(status) {
  switch (status) {
    case 'running': return '#00ff88'
    case 'completed': return '#00d4ff'
    case 'failed': return '#ff4444'
    case 'pending': return '#ffcc00'
    case 'idle': return '#666'
    default: return '#666'
  }
}

export function getModelColor(model) {
  if (!model) return '#666'
  const m = model.toLowerCase()
  if (m.includes('opus')) return '#bd00ff'
  if (m.includes('sonnet')) return '#00d4ff'
  if (m.includes('haiku')) return '#00ff88'
  return '#888'
}

export function truncate(str, n = 80) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

export function extractFirstLine(task) {
  if (!task) return 'Unknown task'
  return task.split('\n')[0].slice(0, 100)
}
