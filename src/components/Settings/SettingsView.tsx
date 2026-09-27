import { describeGamepadBinding, describeKey } from '../../input/GamepadMapping'
import { ACTION_LABELS, type ActionId, type DevicePreference, type InputSettings } from '../../input/types'
import { simulator, useSimulation } from '../../hooks/useSimulation'
import { DEFAULT_VEHICLE_CONFIG } from '../../simulation/constants'
import type { VehicleConfig } from '../../simulation/types'
import { DEFAULT_INPUT_SETTINGS } from '../../input/calibration'
import './Settings.css'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  hint?: string
}

function Slider({ label, value, min, max, step, format, onChange, hint }: SliderProps) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{label}</span>
        <span className="num slider-value">{format(value)}</span>
      </span>
      <span className="slider-track">
        <span className="dim num">{format(min)}</span>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="dim num">{format(max)}</span>
      </span>
      {hint && <span className="dim slider-hint">{hint}</span>}
    </label>
  )
}

const REMAPPABLE: ActionId[] = [
  'clutch',
  'accelerator',
  'brake',
  'gearUp',
  'gearDown',
  'neutral',
  'reverse',
  'gear1',
  'gear2',
  'gear3',
  'gear4',
  'gear5',
  'start',
  'pause',
  'restart',
]

const pct = (v: number) => `${Math.round(v * 100)}%`

export function SettingsView() {
  const s = useSimulation()
  const settings = s.settings
  const input = settings.input
  const vehicle = settings.vehicle

  const setInput = (patch: Partial<InputSettings>) => simulator.updateSettings({ input: { ...input, ...patch } })
  const setVehicle = (patch: Partial<VehicleConfig>) => simulator.updateSettings({ vehicle: { ...vehicle, ...patch } })
  const capturing = s.capturing

  return (
    <div className="settings">
      <section className="panel">
        <div className="panel-title">Dispositivo</div>
        <div className="radio-group" role="radiogroup">
          {(
            [
              ['auto', 'Automático', 'DualSense si está conectado; si no, teclado.'],
              ['gamepad', 'DualSense', 'Usar siempre el mando.'],
              ['keyboard', 'Teclado', 'Usar siempre el teclado.'],
            ] as Array<[DevicePreference, string, string]>
          ).map(([value, label, desc]) => (
            <label key={value} className="radio" data-checked={settings.device === value || undefined}>
              <input
                type="radio"
                name="device"
                checked={settings.device === value}
                onChange={() => simulator.setDevicePreference(value)}
              />
              <span className="radio-dot">{settings.device === value ? '●' : '○'}</span>
              <span>
                <strong>{label}</strong>
                <span className="dim radio-desc">{desc}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          Controles
          <button className="btn btn-sm" onClick={() => simulator.resetBindings()}>
            Restablecer
          </button>
        </div>
        <table className="bindings">
          <thead>
            <tr>
              <th>Acción</th>
              <th>DualSense</th>
              <th>Teclado</th>
            </tr>
          </thead>
          <tbody>
            {REMAPPABLE.map((action) => {
              const gpCapturing = capturing?.device === 'gamepad' && capturing.action === action
              const kbCapturing = capturing?.device === 'keyboard' && capturing.action === action
              const keys = s.keyboardBindings[action] ?? []
              return (
                <tr key={action}>
                  <td>{ACTION_LABELS[action]}</td>
                  <td>
                    <button
                      className="bind-btn"
                      data-capturing={gpCapturing || undefined}
                      onClick={() => (gpCapturing ? simulator.cancelCapture() : simulator.captureBinding('gamepad', action))}
                      title="Pulsa y después mueve el control del mando"
                    >
                      {gpCapturing ? 'Pulsa un control…' : describeGamepadBinding(s.gamepadBindings[action], s.gamepad.mapping !== '' ? s.gamepad.mapping === 'standard' : true)}
                    </button>
                  </td>
                  <td>
                    <button
                      className="bind-btn"
                      data-capturing={kbCapturing || undefined}
                      onClick={() => (kbCapturing ? simulator.cancelCapture() : simulator.captureBinding('keyboard', action))}
                      title="Pulsa y después pulsa una tecla (Esc cancela)"
                    >
                      {kbCapturing ? 'Pulsa una tecla…' : keys.length ? keys.map(describeKey).join(' / ') : '—'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="dim bindings-note">
          Haz clic en una asignación y pulsa el control nuevo. Si reasignas embrague o acelerador, vuelve a calibrar en la pestaña Mando.
        </p>
      </section>

      <section className="panel">
        <div className="panel-title">
          Sensibilidad
          <button className="btn btn-sm" onClick={() => simulator.updateSettings({ input: DEFAULT_INPUT_SETTINGS })}>
            Restablecer
          </button>
        </div>
        <div className="slider-grid">
          <Slider label="Deadzone embrague" value={input.clutch.deadzone} min={0} max={0.1} step={0.005} format={pct} onChange={(v) => setInput({ clutch: { ...input.clutch, deadzone: v } })} />
          <Slider label="Deadzone acelerador" value={input.accelerator.deadzone} min={0} max={0.1} step={0.005} format={pct} onChange={(v) => setInput({ accelerator: { ...input.accelerator, deadzone: v } })} />
          <Slider label="Smoothing embrague" value={input.clutch.smoothing} min={0} max={1} step={0.05} format={pct} onChange={(v) => setInput({ clutch: { ...input.clutch, smoothing: v } })} />
          <Slider label="Smoothing acelerador" value={input.accelerator.smoothing} min={0} max={1} step={0.05} format={pct} onChange={(v) => setInput({ accelerator: { ...input.accelerator, smoothing: v } })} />
          <Slider
            label="Teclado: velocidad al pisar"
            value={input.keyboardPressRate}
            min={0.3}
            max={5}
            step={0.1}
            format={(v) => `${v.toFixed(1)}/s`}
            onChange={(v) => setInput({ keyboardPressRate: v })}
          />
          <Slider
            label="Teclado: velocidad al soltar"
            value={input.keyboardReleaseRate}
            min={0.3}
            max={5}
            step={0.1}
            format={(v) => `${v.toFixed(1)}/s`}
            onChange={(v) => setInput({ keyboardReleaseRate: v })}
          />
          <Slider
            label="Teclado: soltar embrague"
            value={input.keyboardClutchReleaseRate}
            min={0.15}
            max={3}
            step={0.05}
            format={(v) => `${v.toFixed(2)}/s`}
            onChange={(v) => setInput({ keyboardClutchReleaseRate: v })}
            hint="Más bajo = más tiempo para encontrar el punto de fricción."
          />
          <Slider
            label="Freno digital (L1): rampa"
            value={input.digitalBrakeRate}
            min={0.5}
            max={10}
            step={0.1}
            format={(v) => `${v.toFixed(1)}/s`}
            onChange={(v) => setInput({ digitalBrakeRate: v })}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Ayudas y sonido</div>
        <div className="toggles">
          <label className="toggle">
            <input type="checkbox" checked={settings.assistant} onChange={(e) => simulator.updateSettings({ assistant: e.target.checked })} />
            Asistente de conducción
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.showRoad} onChange={(e) => simulator.updateSettings({ showRoad: e.target.checked })} />
            Vista de la ruta
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.debug} onChange={(e) => simulator.updateSettings({ debug: e.target.checked })} />
            Debug mode (F2)
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.audio.enabled}
              onChange={(e) => simulator.updateSettings({ audio: { ...settings.audio, enabled: e.target.checked } })}
            />
            Sonido
          </label>
        </div>
        <Slider
          label="Volumen"
          value={settings.audio.volume}
          min={0}
          max={1}
          step={0.05}
          format={pct}
          onChange={(v) => simulator.updateSettings({ audio: { ...settings.audio, volume: v } })}
        />
      </section>

      <section className="panel">
        <details className="advanced">
          <summary className="panel-title">Configuración avanzada del vehículo</summary>
          <div className="slider-grid">
            <Slider label="RPM ralentí" value={vehicle.idleRpm} min={600} max={1200} step={50} format={(v) => `${v}`} onChange={(v) => setVehicle({ idleRpm: v })} />
            <Slider
              label="RPM máxima (línea roja)"
              value={vehicle.redlineRpm}
              min={4500}
              max={8000}
              step={100}
              format={(v) => `${v}`}
              onChange={(v) => setVehicle({ redlineRpm: v, maxRpm: v + 500 })}
            />
            <Slider label="Potencia" value={vehicle.power} min={0.5} max={2} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setVehicle({ power: v })} />
            <Slider label="Masa" value={vehicle.massKg} min={700} max={2500} step={50} format={(v) => `${v} kg`} onChange={(v) => setVehicle({ massKg: v })} />
            <Slider label="Fuerza de frenado" value={vehicle.brakeForceN} min={3000} max={18000} step={500} format={(v) => `${(v / 1000).toFixed(1)} kN`} onChange={(v) => setVehicle({ brakeForceN: v })} />
            <Slider label="Resistencia" value={vehicle.resistance} min={0.3} max={3} step={0.1} format={(v) => `×${v.toFixed(1)}`} onChange={(v) => setVehicle({ resistance: v })} />
            <Slider
              label="Punto de fricción"
              value={vehicle.clutchBitePoint}
              min={0.35}
              max={0.85}
              step={0.01}
              format={pct}
              onChange={(v) => setVehicle({ clutchBitePoint: v })}
              hint="Posición del pedal (100 % = pisado) en la que empieza a morder."
            />
            <Slider label="Respuesta del acelerador" value={vehicle.throttleResponse} min={0} max={0.4} step={0.01} format={(v) => `${Math.round(v * 1000)} ms`} onChange={(v) => setVehicle({ throttleResponse: v })} />
            <Slider label="Respuesta del embrague" value={vehicle.clutchResponse} min={0} max={0.3} step={0.01} format={(v) => `${Math.round(v * 1000)} ms`} onChange={(v) => setVehicle({ clutchResponse: v })} />
          </div>
          <button className="btn btn-sm advanced-reset" onClick={() => simulator.updateSettings({ vehicle: DEFAULT_VEHICLE_CONFIG })}>
            Restablecer vehículo
          </button>
        </details>
      </section>
    </div>
  )
}
