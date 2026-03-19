import { useEffect, useState } from 'react'
import { spawnAgent, saveConfig } from '../utils/api.js'
import toast from 'react-hot-toast'
import { Rocket, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react'

const MODELS = [
  { value: 'anthropic/claude-opus-4-6', label: 'Opus 4.6 (Most Capable)', color: '#bd00ff' },
  { value: 'anthropic/claude-sonnet-4-6', label: 'Sonnet 4.6 (Balanced)', color: '#00d4ff' },
  { value: 'anthropic/claude-haiku-4-5', label: 'Haiku 4.5 (Fast)', color: '#00ff88' },
  { value: 'openai-codex/gpt-5.3-codex', label: 'GPT-5.3 Codex', color: '#f59e0b' },
]

const THINKING_LEVELS = ['off', 'low', 'medium', 'high']
const TIMEOUTS = [
  { value: 300, label: '5 min' },
  { value: 900, label: '15 min' },
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1 hour' },
]

function moveItem(arr, index, delta) {
  const next = [...arr]
  const target = index + delta
  if (target < 0 || target >= arr.length) return arr
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export function SpawnPanel({ onClose, config, onConfigChange }) {
  const [task, setTask] = useState('')
  const [model, setModel] = useState(config?.defaultModel || 'anthropic/claude-sonnet-4-6')
  const [thinking, setThinking] = useState('off')
  const [timeout, setTimeout_] = useState(900)
  const [spawning, setSpawning] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  const [defaultModel, setDefaultModel] = useState(config?.defaultModel || 'anthropic/claude-sonnet-4-6')
  const [fallbackModels, setFallbackModels] = useState(config?.fallbackModels || [])
  const [autoRetryFallback, setAutoRetryFallback] = useState(config?.autoRetryFallback ?? true)

  useEffect(() => {
    if (!config) return
    setModel(config.defaultModel)
    setDefaultModel(config.defaultModel)
    setFallbackModels(config.fallbackModels || [])
    setAutoRetryFallback(config.autoRetryFallback ?? true)
  }, [config])

  const handleSpawn = async () => {
    if (!task.trim()) {
      toast.error('Please enter a task description')
      return
    }
    setSpawning(true)
    try {
      const result = await spawnAgent({ task, model, thinking, timeout })
      const fallbackUsed = result.attempts?.length > 1
      toast.success(fallbackUsed ? `Spawned via fallback: ${result.modelUsed}` : '🚀 Agent spawned!')
      setTask('')
      onClose?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSpawning(false)
    }
  }

  const persistConfig = async () => {
    setSavingConfig(true)
    try {
      const payload = {
        defaultModel,
        fallbackModels: fallbackModels.filter(Boolean).filter(m => m !== defaultModel),
        autoRetryFallback,
      }
      const result = await saveConfig(payload)
      onConfigChange?.(result.config)
      toast.success('Model policy saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingConfig(false)
    }
  }

  const selectedModel = MODELS.find(m => m.value === model)

  return (
    <div className="glass border border-white/10 rounded-xl p-6 animate-slide-in">
      <h2 className="text-lg font-semibold text-neon-green mb-1 flex items-center gap-2">
        <Rocket size={18} />
        Spawn New Agent
      </h2>
      <p className="text-xs text-gray-500 mb-4">Launch a new AI agent with task + model failover policy</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-black/15 border border-white/5 rounded-lg p-3">
          <h3 className="text-xs font-mono text-neon-blue uppercase tracking-wider mb-2">Global Model Policy</h3>

          <label className="text-xs text-gray-400 mb-1 block">Default model</label>
          <select
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="w-full bg-space-700 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 mb-2"
          >
            {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          <label className="text-xs text-gray-400 mb-1 block">Fallback order</label>
          <div className="space-y-1 mb-2">
            {fallbackModels.map((m, idx) => (
              <div key={`${m}-${idx}`} className="flex items-center gap-2 bg-white/5 px-2 py-1.5 rounded text-xs">
                <span className="flex-1 truncate">{m}</span>
                <button onClick={() => setFallbackModels(moveItem(fallbackModels, idx, -1))} className="text-gray-400 hover:text-white"><ArrowUp size={12} /></button>
                <button onClick={() => setFallbackModels(moveItem(fallbackModels, idx, 1))} className="text-gray-400 hover:text-white"><ArrowDown size={12} /></button>
              </div>
            ))}
          </div>

          <label className="text-xs text-gray-400 mb-1 block">Add fallback model</label>
          <select
            onChange={(e) => {
              const value = e.target.value
              if (!value) return
              setFallbackModels(prev => prev.includes(value) ? prev : [...prev, value])
              e.target.value = ''
            }}
            className="w-full bg-space-700 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 mb-2"
            defaultValue=""
          >
            <option value="" disabled>Select model…</option>
            {MODELS.filter(m => m.value !== defaultModel).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          <label className="flex items-center gap-2 text-xs text-gray-300 mb-3">
            <input type="checkbox" checked={autoRetryFallback} onChange={(e) => setAutoRetryFallback(e.target.checked)} />
            Auto-retry next fallback on rate-limit/quota/model-unavailable
          </label>

          <button
            onClick={persistConfig}
            disabled={savingConfig}
            className="w-full border border-neon-blue/30 text-neon-blue hover:bg-neon-blue/10 rounded py-2 text-xs font-semibold disabled:opacity-50"
          >
            {savingConfig ? 'Saving…' : 'Save model policy'}
          </button>
        </div>

        <div>
          <div className="mb-4">
            <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block mb-1">Task Description *</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what you want the agent to do..."
              rows={5}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 resize-none font-mono leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block mb-1">Model override</label>
              <div className="relative">
                <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-space-700 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 appearance-none cursor-pointer pr-8" style={{ color: selectedModel?.color }}>
                  {MODELS.map(m => <option key={m.value} value={m.value} style={{ color: m.color }}>{m.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block mb-1">Thinking</label>
              <div className="flex gap-1">
                {THINKING_LEVELS.map(level => (
                  <button key={level} onClick={() => setThinking(level)} className={`flex-1 px-2 py-2 rounded text-xs font-mono transition-all ${thinking === level ? 'bg-neon-green/20 text-neon-green border border-neon-green/40' : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/15'}`}>
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block mb-1">Timeout</label>
              <select value={timeout} onChange={(e) => setTimeout_(Number(e.target.value))} className="w-full bg-space-700 border border-white/10 rounded px-3 py-2 text-sm text-gray-200">
                {TIMEOUTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-black/20 rounded p-3 mb-4 border border-white/5 text-xs text-gray-400 font-mono">
            default: {defaultModel} · fallback: {fallbackModels.join(' → ') || 'none'}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSpawn} disabled={spawning || !task.trim()} className="flex-1 btn-neon py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <Rocket size={16} />
              {spawning ? 'Launching...' : 'Launch Agent'}
            </button>
            {onClose && (
              <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors">Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
