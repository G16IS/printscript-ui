import {useCallback, useEffect, useRef, useState} from "react";
import {useAuth0} from "@auth0/auth0-react";

const BACKEND_URL: string = import.meta.env.VITE_BACKEND_URL || '/api'

const runUrl = (id: string) => {
  const base = BACKEND_URL.replace(/\/$/, '')
  const path = `${base}/snippets/${encodeURIComponent(id)}/run`
  if (/^https?:\/\//.test(base)) return path.replace(/^http/, 'ws')
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${path}`
}

/** Runs the saved snippet over the backend WebSocket while `running` is true. */
export const useSnippetRun = (snippetId: string, running: boolean, onFinished: () => void) => {
  const {getAccessTokenSilently} = useAuth0()
  const [lines, setLines] = useState<string[]>([])
  const [pendingInput, setPendingInput] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socket = useRef<WebSocket | null>(null)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  useEffect(() => {
    if (!running) return
    setLines([])
    setError(null)
    setPendingInput(false)
    let closed = false // set on cleanup or after done/error, so a close is not "unexpected"
    let ws: WebSocket | undefined

    const finish = () => {
      closed = true
      setPendingInput(false)
      onFinishedRef.current()
    }

    getAccessTokenSilently().then(token => {
      if (closed) return
      ws = new WebSocket(runUrl(snippetId))
      socket.current = ws
      ws.onopen = () => ws!.send(JSON.stringify({type: 'start', token}))
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        switch (msg.type) {
          case 'output':
            setLines(l => [...l, msg.value])
            break
          case 'input':
            setLines(l => [...l, msg.prompt ?? ''])
            setPendingInput(true)
            break
          case 'done':
            setLines(l => [...l, 'Program finished'])
            finish()
            break
          case 'error':
            setError(msg.message ?? 'Execution failed')
            finish()
            break
        }
      }
      ws.onerror = () => { if (!closed) ws!.close() }
      ws.onclose = () => {
        if (closed) return
        setError('Connection closed unexpectedly')
        finish()
      }
    }).catch(() => {
      if (closed) return
      setError('Could not get an access token')
      finish()
    })

    return () => {
      closed = true
      ws?.close()
      socket.current = null
    }
  }, [running, snippetId, getAccessTokenSilently])

  const sendInput = useCallback((value: string) => {
    socket.current?.send(JSON.stringify({type: 'input', value}))
    // echo what was typed after its prompt line
    setLines(l => [...l.slice(0, -1), `${l[l.length - 1] ?? ''} ${value}`])
    setPendingInput(false)
  }, [])

  return {lines, pendingInput, error, sendInput}
}
