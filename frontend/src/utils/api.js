const BASE = '/api'

export async function fetchAgents() {
  const r = await fetch(`${BASE}/agents`)
  if (!r.ok) throw new Error('Failed to fetch agents')
  return r.json()
}

export async function fetchAgent(id) {
  const r = await fetch(`${BASE}/agents/${id}`)
  if (!r.ok) throw new Error('Failed to fetch agent')
  return r.json()
}

export async function fetchStats() {
  const r = await fetch(`${BASE}/stats`)
  if (!r.ok) throw new Error('Failed to fetch stats')
  return r.json()
}

export async function fetchTimeline() {
  const r = await fetch(`${BASE}/timeline`)
  if (!r.ok) throw new Error('Failed to fetch timeline')
  return r.json()
}

export async function spawnAgent(data) {
  const r = await fetch(`${BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.ok) throw new Error('Failed to spawn agent')
  return r.json()
}

export async function killAgent(id) {
  const r = await fetch(`${BASE}/agents/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('Failed to kill agent')
  return r.json()
}

export async function steerAgent(id, message) {
  const r = await fetch(`${BASE}/agents/${id}/steer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!r.ok) throw new Error('Failed to steer agent')
  return r.json()
}
