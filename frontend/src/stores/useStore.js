import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // UI state
  activeView: 'dashboard', // dashboard | timeline | stats | spawn
  selectedAgentId: null,
  showDetailPanel: false,
  soundEnabled: false,
  
  // Filters
  filterStatus: 'all',
  filterModel: 'all', 
  filterProject: 'all',
  searchQuery: '',
  
  // Agent data (from WS)
  wsAgents: null,
  wsConnected: false,
  
  // Previous agents for detecting changes
  prevAgentStatuses: {},
  
  // Actions
  setView: (view) => set({ activeView: view }),
  selectAgent: (id) => set({ selectedAgentId: id, showDetailPanel: !!id }),
  closeDetail: () => set({ selectedAgentId: null, showDetailPanel: false }),
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  
  setFilter: (key, value) => set({ [key]: value }),
  setSearch: (q) => set({ searchQuery: q }),
  
  setWsAgents: (agents) => {
    const prev = get().prevAgentStatuses
    const sound = get().soundEnabled
    const newStatuses = {}
    
    // Detect status changes
    for (const a of agents) {
      newStatuses[a.id] = a.status
      if (prev[a.id] && prev[a.id] !== a.status) {
        // Status changed!
        if (sound && a.status === 'completed') {
          playTone(600, 0.1, 'sine')
        }
        if (sound && a.status === 'failed') {
          playTone(200, 0.15, 'sawtooth')
        }
      }
    }
    
    set({ wsAgents: agents, prevAgentStatuses: newStatuses })
  },
  
  setWsConnected: (v) => set({ wsConnected: v }),
}))

function playTone(freq, duration, type = 'sine') {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {}
}
