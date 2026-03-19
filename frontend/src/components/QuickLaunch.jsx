import { useState } from 'react'
import { spawnAgent } from '../utils/api.js'
import toast from 'react-hot-toast'
import { Rocket, ChevronDown, Cpu, Server, Monitor, FolderOpen } from 'lucide-react'

const MODELS = [
  { value: '', label: 'Default (policy)', color: '#888' },
  { value: 'anthropic/claude-opus-4-6', label: 'Opus 4.6', color: '#bd00ff' },
  { value: 'anthropic/claude-sonnet-4-6', label: 'Sonnet 4.6', color: '#00d4ff' },
  { value: 'anthropic/claude-haiku-4-5', label: 'Haiku 4.5', color: '#00ff88' },
  { value: 'openai-codex/gpt-5.3-codex', label: 'GPT-5.3 Codex', color: '#f59e0b' },
]

const AGENT_PRESETS = [
  {
    id: 'orchestrator-agent',
    name: 'Orchestrator',
    icon: Cpu,
    color: '#bd00ff',
    borderColor: 'border-purple-500/30',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-300',
    hoverBg: 'hover:bg-purple-500/20',
    description: 'Coordinate backend + frontend execution',
    taskTemplate: `Read project status and goals.\nProduce a compact execution plan (backend/frontend split).\nAssign ownership + acceptance criteria.\nCollect results, identify blockers, reprioritize.\nPublish concise progress snapshot.`,
  },
  {
    id: 'backend-agent',
    name: 'Backend',
    icon: Server,
    color: '#00d4ff',
    borderColor: 'border-neon-blue/30',
    bgColor: 'bg-neon-blue/10',
    textColor: 'text-neon-blue',
    hoverBg: 'hover:bg-neon-blue/20',
    description: 'API, data, auth, tests — production-minded',
    taskTemplate: `Confirm target repo/path and branch.\nImplement backend-scoped task only.\nAdd/adjust targeted backend tests.\nRun relevant checks.\nCommit with clear backend-focused message.\nReturn concise implementation report.`,
  },
  {
    id: 'frontend-agent',
    name: 'Frontend',
    icon: Monitor,
    color: '#00ff88',
    borderColor: 'border-neon-green/30',
    bgColor: 'bg-neon-green/10',
    textColor: 'text-neon-green',
    hoverBg: 'hover:bg-neon-green/20',
    description: 'UI/UX, flows, accessibility, client quality',
    taskTemplate: `Confirm target repo/path and branch.\nImplement frontend-scoped task only.\nRun targeted lint/build/tests for touched files.\nEnsure responsive + dark mode + basic a11y sanity.\nCommit with clear frontend-focused message.\nReturn concise UX-oriented report.`,
  },
]

export function QuickLaunch({ onClose }) {
  const [expandedId, setExpandedId] = useState(null)
  const [modelOverrides, setModelOverrides] = useState({})
  const [repoPaths, setRepoPaths] = useState({})
  const [launching, setLaunching] = useState(null)

  const handleLaunch = async (preset) => {
    setLaunching(preset.id)
    try {
      const repoPath = repoPaths[preset.id]?.trim()
      if (repoPath && !repoPath.startsWith('/')) {
        throw new Error('Repo path must be absolute (start with /)')
      }

      let task = `[${preset.id}] ${preset.taskTemplate}`
      if (repoPath) {
        task = `[${preset.id}] repo: ${repoPath}\n${preset.taskTemplate}`
      }

      const model = modelOverrides[preset.id] || undefined
      const result = await spawnAgent({ agentId: preset.id, task, model, thinking: 'off', timeout: 1800 })
      const fallbackUsed = result.attempts?.length > 1
      toast.success(
        fallbackUsed
          ? `${preset.name} launched via fallback: ${result.modelUsed}`
          : `${preset.name} agent launched`
      )
      onClose?.()
    } catch (err) {
      toast.error(`${preset.name} launch failed: ${err.message}`)
    } finally {
      setLaunching(null)
    }
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="glass border border-white/10 rounded-xl p-5 animate-slide-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-neon-green flex items-center gap-2">
            <Rocket size={18} />
            Quick Launch
          </h2>
          <p className="text-xs text-gray-500">One-click launch for core project agents</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors text-xs"
          >
            Close
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {AGENT_PRESETS.map((preset) => {
          const Icon = preset.icon
          const isExpanded = expandedId === preset.id
          const isLaunching = launching === preset.id

          return (
            <div
              key={preset.id}
              className={`border ${preset.borderColor} rounded-lg overflow-hidden transition-all ${preset.bgColor}`}
            >
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg ${preset.bgColor} border ${preset.borderColor} flex items-center justify-center`}
                  >
                    <Icon size={16} style={{ color: preset.color }} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-semibold ${preset.textColor}`}>{preset.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{preset.id}</p>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mb-3">{preset.description}</p>

                <button
                  onClick={() => toggleExpand(preset.id)}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-3 transition-colors"
                >
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                  {isExpanded ? 'Hide options' : 'Options'}
                </button>

                {isExpanded && (
                  <div className="space-y-2 mb-3 animate-slide-in">
                    <div>
                      <label className="text-xs font-mono text-gray-500 uppercase tracking-wider block mb-1">
                        Model override
                      </label>
                      <div className="relative">
                        <select
                          value={modelOverrides[preset.id] || ''}
                          onChange={(e) =>
                            setModelOverrides((prev) => ({ ...prev, [preset.id]: e.target.value }))
                          }
                          className="w-full bg-space-700 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-200 appearance-none cursor-pointer pr-6"
                        >
                          {MODELS.map((m) => (
                            <option key={m.value} value={m.value} style={{ color: m.color }}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={10}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-mono text-gray-500 uppercase tracking-wider block mb-1">
                        Repo path
                      </label>
                      <div className="relative">
                        <FolderOpen
                          size={12}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"
                        />
                        <input
                          type="text"
                          value={repoPaths[preset.id] || ''}
                          onChange={(e) =>
                            setRepoPaths((prev) => ({ ...prev, [preset.id]: e.target.value }))
                          }
                          placeholder="/path/to/repo"
                          className="w-full bg-space-700 border border-white/10 rounded pl-7 pr-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleLaunch(preset)}
                  disabled={isLaunching || (launching && launching !== preset.id)}
                  className={`w-full border ${preset.borderColor} ${preset.textColor} ${preset.hoverBg} rounded py-2 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
                >
                  <Rocket size={13} />
                  {isLaunching ? 'Launching...' : `Launch ${preset.name}`}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
