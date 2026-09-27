import { simulator, useSimulation } from '../../hooks/useSimulation'
import { CLUTCH_PRESSED_THRESHOLD } from '../../simulation/constants'
import { recommendedGear } from '../../training/assistant'
import { formatDuration } from '../../training/history'
import { DebugPanel } from '../DebugPanel/DebugPanel'
import { DrivingAssistant } from '../DrivingAssistant/DrivingAssistant'
import { ExercisePanel } from '../Exercises/ExercisePanel'
import { GearIndicator } from '../GearIndicator/GearIndicator'
import { GearShift } from '../GearShift/GearShift'
import { Pedals } from '../Pedals/Pedals'
import { RoadView } from '../RoadView/RoadView'
import { SessionSummary } from '../SessionSummary/SessionSummary'
import { Tachometer } from '../Tachometer/Tachometer'
import { ControlsLegend } from './ControlsLegend'
import { PauseMenu } from './PauseMenu'
import { Speedometer } from './Speedometer'
import { WarningBanner } from './WarningBanner'
import './Dashboard.css'

export function Dashboard() {
  const s = useSimulation()
  const v = s.vehicle
  const cfg = s.config
  const gamepad = s.activeDevice === 'gamepad'

  const warning = !v.engineRunning && v.stalled
    ? { title: '⚠ MOTOR CALADO', text: `Pisa el embrague y vuelve a arrancar (${gamepad ? '✕' : 'ESPACIO'}).` }
    : v.limiterActive
      ? { title: '⚠ REDLINE', text: 'Suelta el acelerador o sube de marcha.' }
      : s.assistant.some((a) => a.text.startsWith('⚠ PISA EL EMBRAGUE'))
        ? { title: '⚠ PISA EL EMBRAGUE', text: 'Las RPM están a punto de caer por debajo del ralentí.' }
        : null

  const moving = Math.abs(v.speedKmh) > 5 && v.speedKmh > 0
  const suggestion =
    moving && typeof v.gear === 'number' && recommendedGear(v.speedKmh) !== v.gear ? `Sugerida: ${recommendedGear(v.speedKmh)}ª` : null

  return (
    <div className="drive">
      <div className="drive-bar">
        <span className="mode-label">{s.mode.kind === 'free' ? 'PRÁCTICA LIBRE' : 'EJERCICIO'}</span>
        <span className="num muted">⏱ {formatDuration(s.session.duration)}</span>
        <span className="muted">Calados: {s.session.stalls}</span>
        <div className="drive-bar-center">
          {warning ? (
            <WarningBanner warning={warning} />
          ) : (
            !s.gamepad.connected &&
            s.settings.device !== 'keyboard' && (
              <span className="no-gamepad" title="No se ha detectado ningún mando. Conecta el DualSense mediante USB-C y pulsa cualquier botón.">
                ○ Sin mando: conecta el DualSense por USB-C y pulsa un botón · usando teclado
              </span>
            )
          )}
        </div>
        <button className="btn btn-sm" onClick={() => simulator.setPaused(true)}>
          ❚❚ Pausa <span className="kbd">{gamepad ? 'OPTIONS' : 'Esc'}</span>
        </button>
        <button className="btn btn-sm" onClick={() => simulator.restart()}>
          ↺ Reiniciar <span className="kbd">{gamepad ? 'SHARE' : 'R'}</span>
        </button>
        <button className="btn btn-sm" onClick={() => simulator.updateSettings({ debug: !s.settings.debug })}>
          Debug <span className="kbd">F2</span>
        </button>
        <button className="btn btn-sm btn-danger" onClick={() => simulator.endSession()}>
          Terminar sesión
        </button>
      </div>

      {s.exercise && <ExercisePanel status={s.exercise} />}

      <div className={s.settings.showRoad ? 'dash' : 'dash dash--noroad'}>
        {s.settings.showRoad && (
          <section className="panel area-road">
            <div className="panel-title">Ruta</div>
            <RoadView />
          </section>
        )}


        <section className="panel area-tacho">
          <div className="panel-title">Tacómetro</div>
          <div className="tacho-body">
          <Tachometer
            rpm={v.rpm}
            idleRpm={cfg.idleRpm}
            redlineRpm={cfg.redlineRpm}
            maxRpm={cfg.maxRpm}
            limiter={v.limiterActive}
            running={v.engineRunning}
          />
          </div>
        </section>

        <section className="panel area-assistant">
          <div className="panel-title">Asistente</div>
          <DrivingAssistant
            items={s.assistant}
            feedback={s.feedback}
            enabled={s.settings.assistant}
            lastShift={s.lastShift}
            lastLaunch={s.lastLaunch}
          />
        </section>

        <section className="panel area-speed">
          <div className="panel-title">Velocidad</div>
          <div className="speed-gear">
            <Speedometer speedKmh={v.speedKmh} />
            <GearIndicator gear={v.gear} suggestion={suggestion} />
          </div>
        </section>

        <section className="panel area-pedals">
          <div className="panel-title">Pedales</div>
          <Pedals
            clutch={s.input.clutch}
            brake={s.input.brake}
            accelerator={s.input.accelerator}
            engagement={v.clutchEngagement}
            bitePoint={cfg.clutchBitePoint}
            inGear={v.gear !== 'N'}
          />
        </section>

        <section className="panel area-shift">
          <div className="panel-title">Palanca de cambios</div>
          <div className="shift-row">
            <GearShift gear={v.gear} clutchPressed={s.input.clutch >= CLUTCH_PRESSED_THRESHOLD} />
            <ControlsLegend device={s.activeDevice} gamepad={s.gamepadBindings} keyboard={s.keyboardBindings} />
          </div>
        </section>

        {s.settings.debug && (
          <section className="panel area-debug">
            <div className="panel-title">Debug mode</div>
            <DebugPanel input={s.input} vehicle={v} device={s.activeDevice} />
          </section>
        )}
      </div>

      {s.paused && !s.summary && <PauseMenu />}
      {s.summary && (
        <SessionSummary
          session={s.summary}
          onClose={() => simulator.dismissSummary()}
          onHistory={() => {
            simulator.dismissSummary()
            simulator.setView('history')
          }}
        />
      )}
    </div>
  )
}
