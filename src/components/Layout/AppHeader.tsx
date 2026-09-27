import type { View } from '../../core/Simulator'
import { simulator, useSimulation } from '../../hooks/useSimulation'
import { GamepadStatus } from '../GamepadStatus/GamepadStatus'
import './Layout.css'

const TABS: Array<[View, string]> = [
  ['drive', 'Conducir'],
  ['exercises', 'Ejercicios'],
  ['controller', 'Mando'],
  ['settings', 'Configuración'],
  ['history', 'Historial'],
]

export function AppHeader() {
  const s = useSimulation()
  const audioOn = s.settings.audio.enabled
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark">H</span>
        <span className="brand-name">SIMULADOR MANUAL</span>
      </div>
      <nav className="tabs" aria-label="Secciones">
        {TABS.map(([view, label]) => (
          <button
            key={view}
            className="tab"
            aria-current={s.view === view ? 'page' : undefined}
            onClick={() => simulator.setView(view)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="header-right">
        <button
          className="btn btn-sm btn-ghost"
          title={audioOn ? 'Silenciar' : 'Activar sonido'}
          onClick={() => {
            simulator.unlockAudio()
            simulator.updateSettings({ audio: { ...s.settings.audio, enabled: !audioOn } })
          }}
        >
          {audioOn ? (s.audioUnlocked ? '🔊' : '🔈 Activar sonido') : '🔇'}
        </button>
        <GamepadStatus />
      </div>
    </header>
  )
}

export function Notices() {
  const { notices } = useSimulation()
  return (
    <div className="notices" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className={`notice notice-${n.tone}`}>
          {n.text}
        </div>
      ))}
    </div>
  )
}
