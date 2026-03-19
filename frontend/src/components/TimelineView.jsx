import { useQuery } from '@tanstack/react-query'
import { fetchTimeline } from '../utils/api.js'
import { getStatusDotColor, getModelColor, formatDate, formatRuntime } from '../utils/format.js'
import { useState, useRef } from 'react'
import { RefreshCw, ZoomIn, ZoomOut, Clock } from 'lucide-react'

const ROW_HEIGHT = 36
const ROW_GAP = 4

export function TimelineView({ onSelectAgent }) {
  const { data, isLoading } = useQuery({
    queryKey: ['timeline'],
    queryFn: fetchTimeline,
    refetchInterval: 10000,
  })
  
  const [zoom, setZoom] = useState(1) // 1 = full view, 2 = 2x zoom
  const [hoveredId, setHoveredId] = useState(null)
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        <RefreshCw size={18} className="animate-spin mr-2" />
        Loading timeline...
      </div>
    )
  }
  
  const items = data?.items || []
  const range = data?.range || { start: Date.now() - 3600000, end: Date.now() }
  
  const totalMs = range.end - range.start
  const now = Date.now()
  
  const getXPercent = (ts) => {
    if (!ts) return 0
    return Math.max(0, Math.min(100, ((ts - range.start) / totalMs) * 100))
  }
  
  const getWidthPercent = (startMs, endMs) => {
    const w = ((endMs - startMs) / totalMs) * 100
    return Math.max(0.2, w)
  }
  
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        <Clock size={18} className="mr-2" />
        No timeline data available
      </div>
    )
  }
  
  // Time axis ticks (8 ticks)
  const ticks = Array.from({ length: 9 }, (_, i) => ({
    pct: (i / 8) * 100,
    ts: range.start + (totalMs * i) / 8,
  }))
  
  const totalHeight = items.length * (ROW_HEIGHT + ROW_GAP)
  
  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500 font-mono">
          Showing {items.length} agents · {Math.round(totalMs / 60000)} min window
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="p-1.5 rounded border border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-gray-500 font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(4, z + 0.25))}
            className="p-1.5 rounded border border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
      
      {/* Timeline container */}
      <div className="glass border border-white/5 rounded-xl overflow-hidden">
        {/* Header: time axis */}
        <div className="relative h-8 border-b border-white/5 bg-black/20">
          {ticks.map((tick, i) => (
            <div
              key={i}
              className="absolute h-full"
              style={{ left: `${tick.pct}%` }}
            >
              <div className="absolute top-0 h-full border-l border-white/5" />
              <span className="absolute top-1 text-xs text-gray-600 font-mono -translate-x-1/2 whitespace-nowrap">
                {new Date(tick.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          ))}
          {/* Now indicator */}
          <div
            className="absolute top-0 h-full border-l-2 border-neon-green/50 z-10"
            style={{ left: `${getXPercent(now)}%` }}
          >
            <span className="absolute -top-0 text-xs text-neon-green/70 font-mono ml-1">NOW</span>
          </div>
        </div>
        
        {/* Scrollable timeline rows */}
        <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: '500px' }}>
          <div className="relative" style={{ minWidth: `${100 * zoom}%`, height: totalHeight + 16 }}>
            {/* Grid lines */}
            {ticks.map((tick, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-white/3 z-0"
                style={{ left: `${tick.pct}%` }}
              />
            ))}
            
            {/* Now line */}
            <div
              className="absolute top-0 bottom-0 border-l border-neon-green/30 z-10"
              style={{ left: `${getXPercent(now)}%` }}
            />
            
            {/* Rows */}
            {items.map((item, i) => {
              const x = getXPercent(item.startMs)
              const w = getWidthPercent(item.startMs, item.endMs)
              const color = getStatusDotColor(item.status)
              const isHovered = hoveredId === item.id
              
              return (
                <div
                  key={item.id}
                  className="absolute"
                  style={{ top: 8 + i * (ROW_HEIGHT + ROW_GAP), left: 0, right: 0, height: ROW_HEIGHT }}
                >
                  {/* Label */}
                  <div className="absolute left-0 flex items-center h-full pl-2 z-20 pointer-events-none"
                    style={{ maxWidth: `${x}%` }}>
                    <span className="text-xs text-gray-500 truncate max-w-32 hidden sm:block">
                      {item.label}
                    </span>
                  </div>
                  
                  {/* Bar */}
                  <div
                    className="absolute h-6 rounded cursor-pointer z-10 flex items-center px-2 overflow-hidden"
                    style={{
                      left: `${x}%`,
                      width: `${w}%`,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: `${color}25`,
                      border: `1px solid ${color}60`,
                      boxShadow: isHovered ? `0 0 8px ${color}60` : 'none',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onSelectAgent?.(item.id)}
                    title={`${item.label}\n${item.model} · ${item.status}\n${formatRuntime(item.durationMs)}`}
                  >
                    <span 
                      className="text-xs font-mono truncate"
                      style={{ color }}
                    >
                      {item.label}
                    </span>
                  </div>
                  
                  {/* Hover tooltip */}
                  {isHovered && (
                    <div
                      className="absolute z-50 bg-space-800 border border-white/10 rounded-lg p-3 shadow-xl text-xs"
                      style={{ 
                        top: ROW_HEIGHT + 4,
                        left: `min(${x}%, calc(100% - 220px))`,
                        width: 220,
                      }}
                    >
                      <p className="font-mono text-gray-200 font-semibold mb-1">{item.label}</p>
                      <p className="text-gray-500">Model: <span className="text-gray-300">{item.model}</span></p>
                      <p className="text-gray-500">Status: <span style={{ color }}>{item.status}</span></p>
                      <p className="text-gray-500">Runtime: <span className="text-gray-300">{formatRuntime(item.durationMs)}</span></p>
                      <p className="text-gray-500 mt-1">Start: <span className="text-gray-400">{formatDate(item.startMs)}</span></p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 p-3 border-t border-white/5 text-xs text-gray-500">
          {[
            { label: 'Running', color: '#00ff88' },
            { label: 'Completed', color: '#00d4ff' },
            { label: 'Failed', color: '#ff4444' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${l.color}40`, border: `1px solid ${l.color}60` }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
