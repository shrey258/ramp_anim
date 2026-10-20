import { useEffect, useRef } from 'react'
import { startDunes } from './dunes/startDunes'

function App() {
  const mount = useRef<HTMLDivElement>(null)
  useEffect(() => startDunes(mount.current!), [])
  return <div ref={mount} style={{ position: 'fixed', inset: 0, background: '#000' }} />
}

export default App
