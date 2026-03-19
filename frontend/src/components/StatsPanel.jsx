import { useQuery } from '@tanstack/react-query'
import { fetchStats } from '../utils/api.js'
import { formatTokens, formatRuntime } from '../utils/format.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { RefreshCw } from 'lucide-react'

const MODEL_COLORS = {
  'Opus 4.6': '#bd00ff',
  'Sonnet 4.6': '#00d4ff',
  'Haiku 4.5': '#00ff88',
}

const STATUS_COLORS = {
  completed: '#00d4ff',
  running: '#00ff88',
  failed: '#ff4444',
  idle: '#555',
  pending: '#ffcc00',
}

export function StatsPanel() {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 10000,
  })
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        <RefreshCw size={18} className="animate-spin mr-2" />
        Loading stats...
      </div>
    )
  }
  
  if (!stats) return null
  
  // Prepare chart data
  const modelData = Object.entries(stats.modelCounts || {}).map(([name, count]) => ({
    name,
    count,
    color: MODEL_COLORS[name] || '#888',
  }))
  
  const statusData = [
    { name: 'Running', value: stats.running, color: '#00ff88' },
    { name: 'Completed', value: stats.completed, color: '#00d4ff' },
    { name: 'Failed', value: stats.failed, color: '#ff4444' },
    { name: 'Idle', value: stats.idle, color: '#555' },
  ].filter(d => d.value > 0)
  
  const projectData = Object.entries(stats.projectCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name: name.slice(0, 15), count }))
  
  return (
    <div className="space-y-4">
      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Agents" value={stats.total} accent="green" />
        <StatCard label="Running" value={stats.running} accent="green" pulse />
        <StatCard label="Completed" value={stats.completed} accent="blue" />
        <StatCard label="Failed" value={stats.failed} accent="red" />
        <StatCard label="Today" value={stats.todayCount} accent="purple" />
        <StatCard label="Success Rate" value={`${stats.successRate}%`} accent="yellow" />
      </div>
      
      {/* Token + Cost row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard 
          label="Tokens Today" 
          value={formatTokens(stats.totalTokensToday)} 
          accent="blue"
          subtext="total tokens processed"
        />
        <StatCard 
          label="Avg Runtime" 
          value={formatRuntime(stats.avgRuntimeMs)} 
          accent="green"
          subtext="per completed agent"
        />
        <StatCard 
          label="Est. Cost Today" 
          value={`$${stats.costEstimate}`} 
          accent="yellow"
          subtext={`Top project: ${stats.mostActiveProject}`}
        />
      </div>
      
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status pie */}
        {statusData.length > 0 && (
          <div className="glass border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">Status Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  innerRadius={35}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Model distribution */}
        {modelData.length > 0 && (
          <div className="glass border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">Model Usage</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={modelData} layout="vertical">
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  contentStyle={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {modelData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Project distribution */}
        {projectData.length > 0 && (
          <div className="glass border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">By Project</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={projectData} layout="vertical">
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  contentStyle={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="count" fill="#00d4ff" fillOpacity={0.7} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, subtext, pulse }) {
  const accentColors = {
    green: 'text-neon-green border-neon-green/20',
    blue: 'text-neon-blue border-neon-blue/20',
    red: 'text-red-400 border-red-500/20',
    purple: 'text-purple-400 border-purple-500/20',
    yellow: 'text-yellow-400 border-yellow-500/20',
  }
  
  return (
    <div className={`glass rounded-xl border p-4 ${accentColors[accent] || 'border-white/5'}`}>
      <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${accentColors[accent]?.split(' ')[0]} ${pulse ? 'animate-pulse-slow' : ''}`}>
        {value ?? '—'}
      </p>
      {subtext && <p className="text-xs text-gray-600 mt-1">{subtext}</p>}
    </div>
  )
}
