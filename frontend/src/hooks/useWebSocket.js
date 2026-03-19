import { useEffect, useRef, useState, useCallback } from 'react'

export function useWebSocket(url, onMessage) {
  const ws = useRef(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimeout = useRef(null)

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(url)
      
      ws.current.onopen = () => {
        setConnected(true)
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current)
          reconnectTimeout.current = null
        }
      }
      
      ws.current.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          onMessage(data)
        } catch {}
      }
      
      ws.current.onclose = () => {
        setConnected(false)
        // Reconnect after 3 seconds
        reconnectTimeout.current = setTimeout(connect, 3000)
      }
      
      ws.current.onerror = () => {
        ws.current?.close()
      }
    } catch {}
  }, [url, onMessage])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      ws.current?.close()
    }
  }, [connect])

  return { connected }
}
