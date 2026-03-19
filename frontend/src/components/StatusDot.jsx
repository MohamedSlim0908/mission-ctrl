import { getStatusDotColor } from '../utils/format.js'

export function StatusDot({ status, size = 8 }) {
  const color = getStatusDotColor(status)
  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${status === 'running' ? 'status-dot-running' : ''}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: status === 'running' ? `0 0 6px ${color}` : 'none',
      }}
    />
  )
}
