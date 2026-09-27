import { useGamepad } from '../../hooks/useGamepad'
import './GamepadStatus.css'

export function GamepadStatus() {
  const { diagnostics, connected, active } = useGamepad()
  const name = diagnostics.isDualSense ? 'DUALSENSE' : connected ? 'MANDO' : 'DUALSENSE'
  return (
    <div className="gp-status" data-connected={connected || undefined} title={diagnostics.id || 'Ningún mando detectado'}>
      <span className="gp-dot">{connected ? '●' : '○'}</span>
      <span className="gp-text">{connected ? `${name} CONECTADO` : `${name} NO DETECTADO`}</span>
      <span className="gp-device">{active ? '🎮 Mando' : '⌨ Teclado'}</span>
    </div>
  )
}
