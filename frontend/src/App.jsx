import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { fetchAgents, fetchConfig, killAgent, retryAgent, steerAgent } from './utils/api.js'
import { useWebSocket } from './hooks/useWebSocket.js'
import { useStore } from './stores/useStore.js'
import { AgentCard } from './components/AgentCard.jsx'
import { AgentDetail } from './components/AgentDetail.jsx'
import { SpawnPanel } from './components/SpawnPanel.jsx'
import { StatsPanel } from './components/StatsPanel.jsx'
import { TimelineView } from './components/TimelineView.jsx'
import { FilterBar } from './components/FilterBar.jsx'
import { LayoutDashboard, Clock, BarChart3, Rocket, Wifi, WifiOff, Bell, BellOff, Zap } from 'lucide-react'

const WS_URL = `ws://localhost:3334`

export default function App() {
  const queryClient = useQueryClient()
  const { activeView, setView, selectedAgentId, selectAgent, closeDetail, showDetailPanel, soundEnabled, toggleSound, filterStatus, filterModel, filterProject, searchQuery, wsAgents, setWsAgents, wsConnected, setWsConnected } = useStore()

  const [showSpawn, setShowSpawn] = useState(false)
  const [liveConfig, setLiveConfig] = useState(null)
  const prevStatuses = useRef({})

  const { data: httpData, refetch } = useQuery({ queryKey: ['agents'], queryFn: fetchAgents, refetchInterval: 5000 })
  const { data: configData, refetch: refetchConfig } = useQuery({ queryKey: ['config'], queryFn: fetchConfig })

  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'agents') {
      setWsAgents(msg.data)
      queryClient.setQueryData(['agents'], { agents: msg.data, count: msg.data.length })
    }
    if (msg.type === 'config') {
      setLiveConfig(msg.data)
      queryClient.setQueryData(['config'], { config: msg.data })
    }
  }, [setWsAgents, queryClient])

  const { connected } = useWebSocket(WS_URL, handleWsMessage)
  useEffect(() => setWsConnected(connected), [connected, setWsConnected])

  useEffect(() => {
    const agents = wsAgents || httpData?.agents || []
    for (const agent of agents) {
      const prev = prevStatuses.current[agent.id]
      if (prev && prev !== agent.status) {
        const taskSnippet = (agent.task || '').split('\n')[0].slice(0, 50)
        if (agent.status === 'completed') toast.success(`✅ Agent completed: ${taskSnippet}`, { duration: 5000 })
        else if (agent.status === 'failed') toast.error(`❌ Agent failed: ${taskSnippet}`, { duration: 7000 })
      }
      prevStatuses.current[agent.id] = agent.status
    }
  }, [wsAgents, httpData])

  const allAgents = wsAgents || httpData?.agents || []
  const filteredAgents = allAgents.filter(agent => {
    if (filterStatus !== 'all' && agent.status !== filterStatus) return false
    if (filterModel !== 'all' && agent.model !== filterModel) return false
    if (filterProject !== 'all' && agent.project !== filterProject) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!(agent.task || '').toLowerCase().includes(q) && !(agent.project || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = {
    total: allAgents.length,
    running: allAgents.filter(a => a.status === 'running').length,
    completed: allAgents.filter(a => a.status === 'completed').length,
    failed: allAgents.filter(a => a.status === 'failed').length,
  }

  const handleKill = async (agent) => {
    try {
      await killAgent(agent.id)
      toast.success('Kill signal sent')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleSteer = async (agent) => {
    const message = window.prompt('Steer instruction for this agent:')
    if (!message?.trim()) return
    try {
      await steerAgent(agent.id, message)
      toast.success('Steer note sent')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleRestart = async (agent) => {
    const model = window.prompt('Retry model (leave blank = default model):', agent.modelRaw || '')
    try {
      await retryAgent(agent.id, model || undefined)
      toast.success('Retry launched')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-space-950 grid-bg flex flex-col">
      <header className="glass border-b border-white/5 sticky top-0 z-30 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-neon-green/10 border border-neon-green/30 flex items-center justify-center"><Zap size={14} className="text-neon-green" /></div>
            <div><h1 className="text-sm font-bold text-neon-green leading-none">MISSION CTRL</h1><p className="text-xs text-gray-600 leading-none">OpenClaw Agent Dashboard</p></div>
          </div>

          <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
            <NavBtn icon={<LayoutDashboard size={14} />} label="Dashboard" active={activeView === 'dashboard'} onClick={() => setView('dashboard')} />
            <NavBtn icon={<Clock size={14} />} label="Timeline" active={activeView === 'timeline'} onClick={() => setView('timeline')} />
            <NavBtn icon={<BarChart3 size={14} />} label="Stats" active={activeView === 'stats'} onClick={() => setView('stats')} />
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-1 rounded border border-neon-green/30 text-neon-green">active {stats.running}</span>
              <span className="px-2 py-1 rounded border border-neon-blue/30 text-neon-blue">completed {stats.completed}</span>
              <span className="px-2 py-1 rounded border border-red-500/30 text-red-300">failed {stats.failed}</span>
            </div>

            <button onClick={toggleSound} className={`p-1.5 rounded border transition-colors text-xs ${soundEnabled ? 'border-neon-green/30 text-neon-green' : 'border-white/10 text-gray-500 hover:text-gray-300'}`} title={soundEnabled ? 'Sound on' : 'Sound off'}>
              {soundEnabled ? <Bell size={13} /> : <BellOff size={13} />}
            </button>

            <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono ${wsConnected ? 'border-neon-green/30 text-neon-green' : 'border-yellow-500/30 text-yellow-500'}`}>
              {wsConnected ? <Wifi size={11} /> : <WifiOff size={11} />}<span className="hidden sm:inline">{wsConnected ? 'LIVE' : 'POLL'}</span>
            </div>

            <button onClick={() => setShowSpawn(!showSpawn)} className="btn-neon px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Rocket size={13} /><span className="hidden sm:inline">Spawn</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 gap-4 max-w-7xl mx-auto w-full">
        {showSpawn && <SpawnPanel onClose={() => setShowSpawn(false)} config={liveConfig || configData?.config} onConfigChange={(cfg) => { setLiveConfig(cfg); refetchConfig() }} />}

        {activeView === 'dashboard' && (
          <div className="flex gap-4 flex-1">
            <div className={`flex flex-col gap-4 ${showDetailPanel ? 'flex-1 min-w-0' : 'w-full'}`}>
              <FilterBar agents={allAgents} />
              <div className="space-y-2">
                {filteredAgents.length === 0 ? <EmptyState /> : filteredAgents.map(agent => (
                  <AgentCard key={agent.id} agent={agent} isSelected={agent.id === selectedAgentId} onClick={selectAgent} onKill={handleKill} onRestart={handleRestart} onSteer={handleSteer} />
                ))}
              </div>
              {filteredAgents.length > 0 && <p className="text-xs text-gray-600 text-center font-mono">{filteredAgents.length} agents shown{filteredAgents.length !== allAgents.length && ` (${allAgents.length} total)`}</p>}
            </div>

            {showDetailPanel && selectedAgentId && <div className="w-96 flex-shrink-0 glass border border-white/5 rounded-xl overflow-hidden sticky top-20 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto"><AgentDetail agentId={selectedAgentId} onClose={closeDetail} /></div>}
          </div>
        )}

        {activeView === 'timeline' && <TimelineView onSelectAgent={(id) => { selectAgent(id); setView('dashboard') }} />}
        {activeView === 'stats' && <StatsPanel />}
      </main>

      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,1) 2px, rgba(0,0,0,1) 4px)' }} />
    </div>
  )
}

function NavBtn({ icon, label, active, onClick }) {
  return <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${active ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>{icon}{label}</button>
}

function EmptyState() {
  return <div className="flex flex-col items-center justify-center py-16 text-center"><div className="w-16 h-16 rounded-full bg-neon-green/5 border border-neon-green/10 flex items-center justify-center mb-4"><Zap size={24} className="text-neon-green/40" /></div><h3 className="text-gray-400 font-semibold mb-1">No agents found</h3><p className="text-gray-600 text-sm">Spawn a new agent or adjust your filters</p></div>
}
