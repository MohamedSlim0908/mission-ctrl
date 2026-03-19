import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { fetchAgents, killAgent, spawnAgent } from './utils/api.js'
import { useWebSocket } from './hooks/useWebSocket.js'
import { useStore } from './stores/useStore.js'
import { AgentCard } from './components/AgentCard.jsx'
import { AgentDetail } from './components/AgentDetail.jsx'
import { SpawnPanel } from './components/SpawnPanel.jsx'
import { StatsPanel } from './components/StatsPanel.jsx'
import { TimelineView } from './components/TimelineView.jsx'
import { FilterBar } from './components/FilterBar.jsx'
import { formatTokens } from './utils/format.js'
import {
  LayoutDashboard, Clock, BarChart3, Rocket, 
  Wifi, WifiOff, Bell, BellOff, RefreshCw,
  ChevronLeft, Activity, Zap,
} from 'lucide-react'

const WS_URL = `ws://localhost:3334`

export default function App() {
  const queryClient = useQueryClient()
  const {
    activeView, setView,
    selectedAgentId, selectAgent, closeDetail, showDetailPanel,
    soundEnabled, toggleSound,
    filterStatus, filterModel, filterProject, searchQuery,
    wsAgents, setWsAgents, wsConnected, setWsConnected,
  } = useStore()
  
  const [showSpawn, setShowSpawn] = useState(false)
  const prevStatuses = useRef({})
  
  // HTTP polling fallback
  const { data: httpData, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 5000,
  })
  
  // WebSocket for real-time
  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'agents') {
      setWsAgents(msg.data)
      queryClient.setQueryData(['agents'], { agents: msg.data, count: msg.data.length })
    }
  }, [setWsAgents, queryClient])
  
  const { connected } = useWebSocket(WS_URL, handleWsMessage)
  
  useEffect(() => {
    setWsConnected(connected)
  }, [connected, setWsConnected])
  
  // Detect agent status changes for notifications
  useEffect(() => {
    const agents = wsAgents || httpData?.agents || []
    for (const agent of agents) {
      const prev = prevStatuses.current[agent.id]
      if (prev && prev !== agent.status) {
        if (agent.status === 'completed') {
          const taskSnippet = (agent.task || '').split('\n')[0].slice(0, 50)
          toast.success(`✅ Agent completed: ${taskSnippet}`, { duration: 5000 })
        } else if (agent.status === 'failed') {
          const taskSnippet = (agent.task || '').split('\n')[0].slice(0, 50)
          toast.error(`❌ Agent failed: ${taskSnippet}`, { duration: 7000 })
        }
      }
      prevStatuses.current[agent.id] = agent.status
    }
  }, [wsAgents, httpData])
  
  // Get agents (WS > HTTP)
  const allAgents = wsAgents || httpData?.agents || []
  
  // Filter agents
  const filteredAgents = allAgents.filter(agent => {
    if (filterStatus !== 'all' && agent.status !== filterStatus) return false
    if (filterModel !== 'all' && agent.model !== filterModel) return false
    if (filterProject !== 'all' && agent.project !== filterProject) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!(agent.task || '').toLowerCase().includes(q) &&
          !(agent.project || '').toLowerCase().includes(q)) return false
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
  
  const handleRestart = (agent) => {
    // Pre-fill spawn panel with same task
    setShowSpawn(true)
    setView('dashboard')
    toast('Clone the task to restart the agent', { icon: '🔄' })
  }
  
  const selectedAgent = allAgents.find(a => a.id === selectedAgentId)
  
  return (
    <div className="min-h-screen bg-space-950 grid-bg flex flex-col">
      {/* Top bar */}
      <header className="glass border-b border-white/5 sticky top-0 z-30 px-4 py-2.5">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-neon-green/10 border border-neon-green/30 flex items-center justify-center">
              <Zap size={14} className="text-neon-green" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-neon-green leading-none">MISSION CTRL</h1>
              <p className="text-xs text-gray-600 leading-none">OpenClaw Agent Dashboard</p>
            </div>
          </div>
          
          {/* Nav */}
          <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
            <NavBtn icon={<LayoutDashboard size={14} />} label="Dashboard" active={activeView === 'dashboard'} onClick={() => setView('dashboard')} />
            <NavBtn icon={<Clock size={14} />} label="Timeline" active={activeView === 'timeline'} onClick={() => setView('timeline')} />
            <NavBtn icon={<BarChart3 size={14} />} label="Stats" active={activeView === 'stats'} onClick={() => setView('stats')} />
          </nav>
          
          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Live stats */}
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
              <span className="text-neon-green">{stats.running} running</span>
              <span className="text-gray-600">·</span>
              <span className="text-neon-blue">{stats.completed} done</span>
              {stats.failed > 0 && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-red-400">{stats.failed} failed</span>
                </>
              )}
            </div>
            
            {/* Sound toggle */}
            <button
              onClick={toggleSound}
              className={`p-1.5 rounded border transition-colors text-xs
                ${soundEnabled 
                  ? 'border-neon-green/30 text-neon-green' 
                  : 'border-white/10 text-gray-500 hover:text-gray-300'}`}
              title={soundEnabled ? 'Sound on' : 'Sound off'}
            >
              {soundEnabled ? <Bell size={13} /> : <BellOff size={13} />}
            </button>
            
            {/* Connection status */}
            <div 
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono
                ${wsConnected 
                  ? 'border-neon-green/30 text-neon-green' 
                  : 'border-yellow-500/30 text-yellow-500'}`}
            >
              {wsConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
              <span className="hidden sm:inline">{wsConnected ? 'LIVE' : 'POLL'}</span>
            </div>
            
            {/* Spawn button */}
            <button
              onClick={() => setShowSpawn(!showSpawn)}
              className="btn-neon px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Rocket size={13} />
              <span className="hidden sm:inline">Spawn</span>
            </button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col p-4 gap-4 max-w-7xl mx-auto w-full">
        {/* Spawn panel */}
        {showSpawn && (
          <SpawnPanel onClose={() => setShowSpawn(false)} />
        )}
        
        {/* Dashboard view */}
        {activeView === 'dashboard' && (
          <div className="flex gap-4 flex-1">
            {/* Agent list */}
            <div className={`flex flex-col gap-4 ${showDetailPanel ? 'flex-1 min-w-0' : 'w-full'}`}>
              {/* Filter bar */}
              <FilterBar agents={allAgents} />
              
              {/* Agent cards */}
              <div className="space-y-2">
                {filteredAgents.length === 0 ? (
                  <EmptyState />
                ) : (
                  filteredAgents.map(agent => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      isSelected={agent.id === selectedAgentId}
                      onClick={selectAgent}
                      onKill={handleKill}
                      onRestart={handleRestart}
                    />
                  ))
                )}
              </div>
              
              {filteredAgents.length > 0 && (
                <p className="text-xs text-gray-600 text-center font-mono">
                  {filteredAgents.length} agents shown
                  {filteredAgents.length !== allAgents.length && ` (${allAgents.length} total)`}
                </p>
              )}
            </div>
            
            {/* Detail panel */}
            {showDetailPanel && selectedAgentId && (
              <div className="w-96 flex-shrink-0 glass border border-white/5 rounded-xl overflow-hidden sticky top-20 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto">
                <AgentDetail 
                  agentId={selectedAgentId}
                  onClose={closeDetail}
                />
              </div>
            )}
          </div>
        )}
        
        {/* Timeline view */}
        {activeView === 'timeline' && (
          <TimelineView onSelectAgent={(id) => {
            selectAgent(id)
            setView('dashboard')
          }} />
        )}
        
        {/* Stats view */}
        {activeView === 'stats' && (
          <StatsPanel />
        )}
      </main>
      
      {/* Bottom scanline effect */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.02]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,1) 2px, rgba(0,0,0,1) 4px)'
        }}
      />
    </div>
  )
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
        ${active 
          ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' 
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
    >
      {icon}
      {label}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-neon-green/5 border border-neon-green/10 flex items-center justify-center mb-4">
        <Activity size={24} className="text-neon-green/40" />
      </div>
      <h3 className="text-gray-400 font-semibold mb-1">No agents found</h3>
      <p className="text-gray-600 text-sm">Spawn a new agent or adjust your filters</p>
    </div>
  )
}
