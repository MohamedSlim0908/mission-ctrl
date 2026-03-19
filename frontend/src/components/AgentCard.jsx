import { StatusDot } from './StatusDot.jsx'
import { formatRuntime, formatTokens, formatTimeAgo, getStatusBgClass, getModelColor, extractFirstLine } from '../utils/format.js'
import { Clock, Hash, ChevronRight, Zap, X, RotateCcw, Send } from 'lucide-react'

export function AgentCard({ agent, isSelected, onClick, onKill, onRestart, onSteer }) {
  const taskTitle = extractFirstLine(agent.task)
  const modelColor = getModelColor(agent.model)
  const statusBg = getStatusBgClass(agent.status)

  return (
    <div
      className={`agent-card glass rounded-lg border p-4 cursor-pointer transition-all duration-200 ${isSelected ? 'border-neon-green/50 shadow-neon-green' : 'border-white/5 hover:border-white/15'}`}
      onClick={() => onClick(agent.id)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex-shrink-0"><StatusDot status={agent.status} size={10} /></div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded border font-mono ${statusBg}`}>{agent.status}</span>
            <span className="text-xs px-2 py-0.5 rounded border" style={{ color: modelColor, borderColor: `${modelColor}40`, background: `${modelColor}10` }}>{agent.model}</span>
            <span className="text-xs text-gray-500 border border-white/5 px-2 py-0.5 rounded">{agent.project}</span>
            {agent.errorReason && (
              <span className="text-xs px-2 py-0.5 rounded border border-red-500/30 text-red-300 bg-red-500/10">
                {agent.errorReason}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-200 font-medium truncate">{taskTitle}</p>

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Clock size={11} />{formatRuntime(agent.runtimeMs)}</span>
            {agent.tokens?.total && <span className="flex items-center gap-1"><Hash size={11} />{formatTokens(agent.tokens.total)} tok</span>}
            <span className="flex items-center gap-1 ml-auto"><Zap size={11} />{formatTimeAgo(agent.createdAt)}</span>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-1">
          {agent.status === 'running' && (
            <>
              <button className="p-1 rounded text-neon-blue hover:bg-blue-500/10 hover:text-blue-300 transition-colors" onClick={(e) => { e.stopPropagation(); onSteer?.(agent) }} title="Quick steer">
                <Send size={14} />
              </button>
              <button className="p-1 rounded text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors" onClick={(e) => { e.stopPropagation(); onKill?.(agent) }} title="Kill agent">
                <X size={14} />
              </button>
            </>
          )}
          {agent.status === 'failed' && (
            <button className="p-1 rounded text-yellow-400 hover:bg-yellow-500/10 transition-colors" onClick={(e) => { e.stopPropagation(); onRestart?.(agent) }} title="Retry with chosen model">
              <RotateCcw size={14} />
            </button>
          )}
          <ChevronRight size={14} className="text-gray-600" />
        </div>
      </div>

      {agent.status === 'running' && agent.runTimeoutSeconds && (
        <div className="mt-2 h-0.5 bg-white/5 rounded overflow-hidden">
          <div className="h-full bg-neon-green/50 transition-all duration-1000" style={{ width: `${Math.min(100, (agent.runtimeSec / agent.runTimeoutSeconds) * 100)}%`, boxShadow: '0 0 4px rgba(0, 255, 136, 0.6)' }} />
        </div>
      )}
    </div>
  )
}
