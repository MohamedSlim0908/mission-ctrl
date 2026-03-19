import { useState } from 'react'
import { spawnAgent } from '../utils/api.js'
import toast from 'react-hot-toast'
import { Rocket, ChevronDown } from 'lucide-react'

const MODELS = [
  { value: 'anthropic/claude-opus-4-6', label: 'Opus 4.6 (Most Capable)', color: '#bd00ff' },
  { value: 'anthropic/claude-sonnet-4-6', label: 'Sonnet 4.6 (Balanced)', color: '#00d4ff' },
  { value: 'anthropic/claude-haiku-4-5', label: 'Haiku 4.5 (Fast)', color: '#00ff88' },
]

const THINKING_LEVELS = ['off', 'low', 'medium', 'high']
const TIMEOUTS = [
  { value: 300, label: '5 min' },
  { value: 900, label: '15 min' },
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1 hour' },
]

export function SpawnPanel({ onClose }) {
  const [task, setTask] = useState('')
  const [model, setModel] = useState('anthropic/claude-sonnet-4-6')
  const [thinking, setThinking] = useState('off')
  const [timeout, setTimeout_] = useState(900)
  const [spawning, setSpawning] = useState(false)
  
  const handleSpawn = async () => {
    if (!task.trim()) {
      toast.error('Please enter a task description')
      return
    }
    setSpawning(true)
    try {
      await spawnAgent({ task, model, thinking, timeout })
      toast.success('🚀 Agent spawned!')
      setTask('')
      onClose?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSpawning(false)
    }
  }
  
  const selectedModel = MODELS.find(m => m.value === model)
  
  return (
    <div className="glass border border-white/10 rounded-xl p-6 animate-slide-in">
      <h2 className="text-lg font-semibold text-neon-green mb-1 flex items-center gap-2">
        <Rocket size={18} />
        Spawn New Agent
      </h2>
      <p className="text-xs text-gray-500 mb-4">Launch a new AI agent with a task</p>
      
      {/* Task */}
      <div className="mb-4">
        <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block mb-1">
          Task Description *
        </label>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe what you want the agent to do..."
          rows={5}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-200 
            placeholder-gray-600 resize-none font-mono leading-relaxed"
        />
      </div>
      
      {/* Model + Thinking + Timeout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {/* Model */}
        <div>
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block mb-1">Model</label>
          <div className="relative">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-space-700 border border-white/10 rounded px-3 py-2 text-sm 
                text-gray-200 appearance-none cursor-pointer pr-8"
              style={{ color: selectedModel?.color }}
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value} style={{ color: m.color }}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </div>
        
        {/* Thinking */}
        <div>
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block mb-1">Thinking</label>
          <div className="flex gap-1">
            {THINKING_LEVELS.map(level => (
              <button
                key={level}
                onClick={() => setThinking(level)}
                className={`flex-1 px-2 py-2 rounded text-xs font-mono transition-all
                  ${thinking === level 
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/40' 
                    : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/15'}`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        
        {/* Timeout */}
        <div>
          <label className="text-xs font-mono text-gray-400 uppercase tracking-wider block mb-1">Timeout</label>
          <div className="relative">
            <select
              value={timeout}
              onChange={(e) => setTimeout_(Number(e.target.value))}
              className="w-full bg-space-700 border border-white/10 rounded px-3 py-2 text-sm 
                text-gray-200 appearance-none cursor-pointer pr-8"
            >
              {TIMEOUTS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>
      
      {/* Preview */}
      <div className="bg-black/20 rounded p-3 mb-4 border border-white/5">
        <p className="text-xs font-mono text-gray-500">
          <span className="text-neon-green">$</span> openclaw agent 
          <span className="text-yellow-400"> -m "[task]"</span>
          <span className="text-blue-400"> --model {model.split('/')[1]}</span>
          {thinking !== 'off' && <span className="text-purple-400"> --thinking {thinking}</span>}
          <span className="text-gray-400"> --timeout {timeout}</span>
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSpawn}
          disabled={spawning || !task.trim()}
          className="flex-1 btn-neon py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Rocket size={16} />
          {spawning ? 'Launching...' : 'Launch Agent'}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-gray-200
              hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
