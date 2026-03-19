const BASE = '/api'

async function parseOrThrow(r, fallback) {
  const body = await r.json().catch(() => ({}))
  if (!r.ok) {
    throw new Error(body?.error || fallback)
  }
  return body
}

export async function fetchAgents() {
  const r = await fetch(`${BASE}/agents`)
  return parseOrThrow(r, 'Failed to fetch agents')
}

export async function fetchAgent(id) {
  const r = await fetch(`${BASE}/agents/${id}`)
  return parseOrThrow(r, 'Failed to fetch agent')
}

export async function fetchStats() {
  const r = await fetch(`${BASE}/stats`)
  return parseOrThrow(r, 'Failed to fetch stats')
}

export async function fetchTimeline() {
  const r = await fetch(`${BASE}/timeline`)
  return parseOrThrow(r, 'Failed to fetch timeline')
}

export async function fetchConfig() {
  const r = await fetch(`${BASE}/config`)
  return parseOrThrow(r, 'Failed to fetch config')
}

export async function saveConfig(config) {
  const r = await fetch(`${BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  return parseOrThrow(r, 'Failed to save config')
}

export async function spawnAgent(data) {
  const r = await fetch(`${BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return parseOrThrow(r, 'Failed to spawn agent')
}

export async function retryAgent(id, model) {
  const r = await fetch(`${BASE}/agents/${id}/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  return parseOrThrow(r, 'Failed to retry agent')
}

export async function killAgent(id) {
  const r = await fetch(`${BASE}/agents/${id}`, { method: 'DELETE' })
  return parseOrThrow(r, 'Failed to kill agent')
}

export async function steerAgent(id, message) {
  const r = await fetch(`${BASE}/agents/${id}/steer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  return parseOrThrow(r, 'Failed to steer agent')
}
