import { useStore } from '../stores/useStore.js'
import { Search, X } from 'lucide-react'

const STATUS_OPTIONS = ['all', 'running', 'completed', 'failed', 'idle', 'pending']
const MODEL_OPTIONS = ['all', 'Opus 4.6', 'Sonnet 4.6', 'Haiku 4.5']

export function FilterBar({ agents = [] }) {
  const { filterStatus, filterModel, filterProject, searchQuery, setFilter, setSearch } = useStore()
  
  // Extract unique projects from agents
  const projects = ['all', ...new Set(agents.map(a => a.project).filter(Boolean))]
  
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-40">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks..."
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm 
            text-gray-200 placeholder-gray-600 font-mono"
        />
        {searchQuery && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            <X size={13} />
          </button>
        )}
      </div>
      
      {/* Status filter */}
      <FilterSelect
        label="Status"
        value={filterStatus}
        options={STATUS_OPTIONS}
        onChange={(v) => setFilter('filterStatus', v)}
      />
      
      {/* Model filter */}
      <FilterSelect
        label="Model"
        value={filterModel}
        options={MODEL_OPTIONS}
        onChange={(v) => setFilter('filterModel', v)}
      />
      
      {/* Project filter */}
      <FilterSelect
        label="Project"
        value={filterProject}
        options={projects}
        onChange={(v) => setFilter('filterProject', v)}
      />
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 
        font-mono cursor-pointer hover:border-white/20 transition-colors"
    >
      {options.map(opt => (
        <option key={opt} value={opt}>
          {opt === 'all' ? `All ${label}s` : opt}
        </option>
      ))}
    </select>
  )
}
