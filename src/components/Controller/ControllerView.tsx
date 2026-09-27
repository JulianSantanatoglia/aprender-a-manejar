import { useSimulation } from '../../hooks/useSimulation'
import { Calibration } from './Calibration'
import { GamepadDiagnostics } from './GamepadDiagnostics'
import './Controller.css'

export function ControllerView() {
  const s = useSimulation()
  return (
    <div className="controller-grid">
      <section className="panel">
        <div className="panel-title">🎮 Configuración del DualSense</div>
        <GamepadDiagnostics d={s.gamepad} />
      </section>
      <div className="stack">
        <section className="panel">
          <div className="panel-title">Calibración</div>
          <Calibration diagnostics={s.gamepad} calibration={s.calibration} />
        </section>
        <section className="panel">
          <div className="panel-title">Comprobación</div>
          <ul className="check-list">
            <li className={s.gamepad.connected ? 'ok-text' : 'dim'}>{s.gamepad.connected ? '✓' : '○'} Mando detectado</li>
            <li className={s.gamepad.processed.clutch > 0.99 ? 'ok-text' : 'dim'}>L2 llega al 100 %</li>
            <li className={s.gamepad.processed.accelerator > 0.99 ? 'ok-text' : 'dim'}>R2 llega al 100 %</li>
            <li className="muted">Con los gatillos sueltos ambos deben marcar 0 %.</li>
          </ul>
          <p className="dim calib-note">
            El DualSense funciona igual por USB-C o Bluetooth; para empezar se recomienda USB-C.
          </p>
        </section>
      </div>
    </div>
  )
}
