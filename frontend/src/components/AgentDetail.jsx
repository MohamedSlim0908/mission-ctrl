import { useQuery } from '@tanstack/react-query'
import { fetchAgent } from '../utils/api.js'
import { formatRuntime, formatTokens, getStatusBgClass, getModelColor } from '../utils/format.js'
import { StatusDot } from './StatusDot.jsx'
import { X, Send, Copy, RefreshCw } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { steerAgent } from '../utils/api.js'
import toast from 'react-hot-toast'

export function AgentDetail({ agentId, onClose }) {
  const [steerMsg, setSteerMsg] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const logsRef = useRef(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => fetchAgent(agentId),
    refetchInterval: 3000,
    enabled: !!agentId,
  })

  const agent = data?.agent
  const logs = data?.logs || []

  useEffect(() => {
    if (autoScroll && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs.length, autoScroll])

  const handleSteer = async () => {
    if (!steerMsg.trim()) return
    try {
      await steerAgent(agentId, steerMsg)
      toast.success('Steer message sent')
      setSteerMsg('')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const copyKey = () => {
    if (agent?.sessionKey) {
      navigator.clipboard.writeText(agent.sessionKey)
      toast.success('Session key copied')
    }
  }

  if (isLoading) return <div className="h-full flex items-center justify-center text-gray-500"><RefreshCw size={20} className="animate-spin mr-2" />Loading...</div>
  if (!agent) return <div className="h-full flex items-center justify-center text-gray-500">Agent not found</div>

  const modelColor = getModelColor(agent.model)
  const statusBg = getStatusBgClass(agent.status)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusDot status={agent.status} size={10} />
          <span className={`text-xs px-2 py-0.5 rounded border ${statusBg}`}>{agent.status}</span>
          <span className="text-xs px-2 py-0.5 rounded border" style={{ color: modelColor, borderColor: `${modelColor}40`, background: `${modelColor}10` }}>{agent.model}</span>
          {agent.errorReason && <span className="text-xs px-2 py-0.5 rounded border border-red-500/30 text-red-300 bg-red-500/10">{agent.errorReason}</span>}
          {agent.thinkingLevel && agent.thinkingLevel !== 'off' && <span className="text-xs px-2 py-0.5 rounded border border-purple-500/30 text-purple-400 bg-purple-500/10">thinking:{agent.thinkingLevel}</span>}
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-xs font-mono text-neon-green/70 uppercase tracking-wider mb-2">Task</h3>
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{agent.task}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 border-b border-white/5">
          <MetricBox label="Runtime" value={formatRuntime(agent.runtimeMs)} />
          <MetricBox label="Project" value={agent.project} />
          <MetricBox label="Total Tokens" value={formatTokens(agent.tokens?.total)} />
          <MetricBox label="Output Tokens" value={formatTokens(agent.tokens?.output)} />
          <MetricBox label="Thinking" value={agent.thinkingLevel || 'off'} />
          <MetricBox label="Timeout" value={agent.runTimeoutSeconds ? `${agent.runTimeoutSeconds}s` : '—'} />
        </div>

        {agent.sessionKey && (
          <div className="p-4 border-b border-white/5">
            <h3 className="text-xs font-mono text-neon-green/70 uppercase tracking-wider mb-2">Session Key</h3>
            <div className="flex items-center gap-2">
              <code className="text-xs text-gray-400 font-mono bg-white/5 px-2 py-1 rounded flex-1 truncate">{agent.sessionKey}</code>
              <button onClick={copyKey} className="text-gray-500 hover:text-gray-300 p-1"><Copy size={14} /></button>
            </div>
          </div>
        )}

        {agent.frozenResult && (
          <div className="p-4 border-b border-white/5">
            <h3 className="text-xs font-mono text-neon-green/70 uppercase tracking-wider mb-2">Result</h3>
            <p className="text-sm text-green-300 leading-relaxed">{agent.frozenResult}</p>
          </div>
        )}

        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-mono text-neon-green/70 uppercase tracking-wider">Live Log ({logs.length} entries)</h3>
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1 text-gray-400">
                <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> auto-scroll
              </label>
              <button onClick={() => refetch()} className="text-gray-500 hover:text-gray-300 p-1"><RefreshCw size={12} /></button>
            </div>
          </div>

          <div ref={logsRef} className="log-content bg-black/40 rounded border border-white/10 p-3 max-h-80 overflow-y-auto space-y-2">
            {logs.length === 0 ? <p className="text-gray-600 text-xs">No logs available</p> : logs.map((log, i) => <LogEntry key={i} log={log} />)}
          </div>

          {!autoScroll && (
            <button
              onClick={() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight }}
              className="mt-2 text-xs border border-white/10 text-gray-300 px-2 py-1 rounded hover:border-white/20"
            >
              Jump to latest
            </button>
          )}
        </div>
      </div>

      {agent.status === 'running' && (
        <div className="p-4 border-t border-white/5">
          <h3 className="text-xs font-mono text-neon-blue/70 uppercase tracking-wider mb-2">Steer Agent</h3>
          <div className="flex gap-2">
            <input type="text" value={steerMsg} onChange={(e) => setSteerMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSteer()} placeholder="Send a message to redirect focus..." className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 font-mono" />
            <button onClick={handleSteer} className="btn-neon-blue px-3 py-2 rounded text-sm flex items-center gap-1"><Send size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricBox({ label, value }) {
  return <div className="bg-white/3 rounded p-3"><p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">{label}</p><p className="text-sm text-gray-200 font-mono">{value || '—'}</p></div>
}

function LogEntry({ log }) {
  const roleColors = { user: 'text-neon-blue', assistant: 'text-neon-green', system: 'text-gray-500', tool: 'text-yellow-400' }
  const roleColor = roleColors[log.role] || 'text-gray-400'
  return <div className="text-xs"><span className={`${roleColor} font-bold`}>[{log.role || 'system'}]</span> <span className="text-gray-300 whitespace-pre-wrap">{(log.content || '').slice(0, 700)}</span></div>
}
