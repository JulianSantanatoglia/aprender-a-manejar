import { useEffect, useReducer, useState } from 'react'
import { defaultCalibration } from '../../input/calibration'
import { CalibrationWizard, type CalibrationStep } from '../../input/CalibrationWizard'
import type { Calibration as CalibrationData, GamepadDiagnostics } from '../../input/types'
import { simulator } from '../../hooks/useSimulation'

const STEP_TEXT: Record<CalibrationStep, { title: string; text: string }> = {
  intro: { title: 'Antes de empezar', text: 'Ajusta el recorrido real de L2 y R2 de tu mando. Tarda unos segundos.' },
  rest: { title: 'Paso 1 de 3', text: 'Suelta todos los botones y gatillos.' },
  clutch: { title: 'Paso 2 de 3', text: 'Pulsa L2 completamente (y suéltalo).' },
  accelerator: { title: 'Paso 3 de 3', text: 'Pulsa R2 completamente (y suéltalo).' },
  done: { title: 'Calibración completada', text: 'Valores guardados en este navegador.' },
}

interface Props {
  diagnostics: GamepadDiagnostics
  calibration: CalibrationData
}

export function Calibration({ diagnostics, calibration }: Props) {
  const [wizard] = useState(() => new CalibrationWizard())
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  const connected = diagnostics.connected

  useEffect(() => {
    if (!connected) return
    wizard.feed({ clutch: diagnostics.raw.clutch, accelerator: diagnostics.raw.accelerator })
    if (wizard.step === 'rest' && wizard.canAdvance()) {
      wizard.next()
      rerender()
    }
  }, [diagnostics, connected, wizard])

  const next = () => {
    wizard.next()
    if (wizard.step === 'done') simulator.setCalibration(wizard.result())
    rerender()
  }

  const restart = () => {
    wizard.start()
    rerender()
  }

  const step = STEP_TEXT[wizard.step]
  const inProgress = wizard.step !== 'intro' && wizard.step !== 'done'

  return (
    <div className="calib">
      <div className="calib-step">
        <span className="calib-kicker">{step.title}</span>
        <p className="calib-text">{step.text}</p>
        {inProgress && (
          <div className="bar calib-progress">
            <div className="bar-fill" style={{ width: `${Math.round(wizard.progress() * 100)}%` }} />
          </div>
        )}
      </div>

      <div className="row">
        {wizard.step === 'intro' && (
          <button className="btn btn-primary" disabled={!connected} onClick={next}>
            Empezar calibración
          </button>
        )}
        {(wizard.step === 'clutch' || wizard.step === 'accelerator') && (
          <button className="btn btn-primary" disabled={!wizard.canAdvance()} onClick={next}>
            {wizard.canAdvance() ? 'Guardar y continuar' : 'Esperando gatillo…'}
          </button>
        )}
        {wizard.step === 'done' && (
          <button className="btn" onClick={restart}>
            Calibrar de nuevo
          </button>
        )}
        {inProgress && (
          <button className="btn btn-ghost" onClick={restart}>
            Reiniciar pasos
          </button>
        )}
        <span className="spacer" />
        <button className="btn btn-sm btn-ghost" onClick={() => simulator.setCalibration(defaultCalibration())}>
          Restablecer valores por defecto
        </button>
      </div>
      {!connected && <p className="dim">Conecta el mando para calibrar.</p>}

      <div className="calib-values num">
        <div>
          <span className="dim">clutchMin</span> {calibration.clutch.min.toFixed(3)}
        </div>
        <div>
          <span className="dim">clutchMax</span> {calibration.clutch.max.toFixed(3)}
        </div>
        <div>
          <span className="dim">acceleratorMin</span> {calibration.accelerator.min.toFixed(3)}
        </div>
        <div>
          <span className="dim">acceleratorMax</span> {calibration.accelerator.max.toFixed(3)}
        </div>
        <div className={calibration.calibrated ? 'ok-text' : 'dim'}>
          {calibration.calibrated ? '✓ Calibrado' : 'Sin calibrar (valores por defecto)'}
        </div>
      </div>
    </div>
  )
}
