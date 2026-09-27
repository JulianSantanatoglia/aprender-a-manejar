import { simulator } from '../../hooks/useSimulation'

export function PauseMenu() {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="modal pause-menu">
        <h2 id="pause-title">SIMULACIÓN PAUSADA</h2>
        <button className="btn btn-primary" onClick={() => simulator.setPaused(false)} autoFocus>
          Continuar
        </button>
        <button className="btn" onClick={() => simulator.restart()}>
          Reiniciar
        </button>
        <button className="btn" onClick={() => simulator.setView('settings')}>
          Configuración
        </button>
        <button className="btn btn-danger" onClick={() => simulator.endSession()}>
          Salir
        </button>
        <p className="dim pause-hint">
          <span className="kbd">OPTIONS</span> / <span className="kbd">Esc</span> o <span className="kbd">✕</span> para continuar ·{' '}
          <span className="kbd">SHARE</span> reinicia
        </p>
      </div>
    </div>
  )
}
