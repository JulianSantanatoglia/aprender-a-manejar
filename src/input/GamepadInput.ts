import { applyDeadzone, clamp01, defaultCalibration, DEFAULT_INPUT_SETTINGS, normalize, rampTowards, smooth } from './calibration'
import { DEFAULT_GAMEPAD_BINDINGS, isDualSense, readBinding } from './GamepadMapping'
import { EdgeTracker, type InputDevice } from './InputDevice'
import {
  DIRECT_GEAR_ACTIONS,
  EMPTY_INPUT,
  type ActionId,
  type AnalogAction,
  type Calibration,
  type DigitalAction,
  type GamepadBinding,
  type GamepadBindings,
  type GamepadDiagnostics,
  type InputSettings,
  type InputState,
} from './types'

type GamepadSource = () => ReadonlyArray<Gamepad | null>

const browserGamepads: GamepadSource = () =>
  typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []

const DIGITAL_ACTIONS: DigitalAction[] = [
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
const PRESS_THRESHOLD = 0.5

export type ConnectionListener = (event: 'connected' | 'disconnected', id: string) => void
type CaptureCallback = (binding: GamepadBinding) => void

/**
 * DualSense (o cualquier mando) mediante la Web Gamepad API.
 * El sondeo se hace desde el bucle principal (requestAnimationFrame): no hay intervalos.
 */
export class GamepadInput implements InputDevice {
  readonly kind = 'gamepad' as const
  private source: GamepadSource
  private gamepadIndex: number | null = null
  private bindings: GamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS }
  private calibration: Calibration = defaultCalibration()
  private settings: InputSettings = DEFAULT_INPUT_SETTINGS
  private state: InputState = { ...EMPTY_INPUT }
  private edges = new EdgeTracker<DigitalAction>()
  private listeners = new Set<ConnectionListener>()
  private capture: { callback: CaptureCallback; baseline: { axes: number[]; buttons: number[] } | null } | null = null
  private diagnostics: GamepadDiagnostics = emptyDiagnostics()
  private attached = false

  constructor(source: GamepadSource = browserGamepads) {
    this.source = source
  }

  // ─── Configuración ─────────────────────────────────────────────────────
  setBindings(b: GamepadBindings) {
    this.bindings = { ...b }
  }
  getBindings(): GamepadBindings {
    return this.bindings
  }
  setCalibration(c: Calibration) {
    this.calibration = c
  }
  getCalibration(): Calibration {
    return this.calibration
  }
  setSettings(s: InputSettings) {
    this.settings = s
  }

  // ─── Conexión ──────────────────────────────────────────────────────────
  attach() {
    if (this.attached || typeof window === 'undefined') return
    window.addEventListener('gamepadconnected', this.onConnected)
    window.addEventListener('gamepaddisconnected', this.onDisconnected)
    this.attached = true
  }

  detach() {
    if (!this.attached) return
    window.removeEventListener('gamepadconnected', this.onConnected)
    window.removeEventListener('gamepaddisconnected', this.onDisconnected)
    this.attached = false
  }

  onConnection(listener: ConnectionListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private onConnected = (e: GamepadEvent) => {
    if (this.gamepadIndex === null || isDualSense(e.gamepad.id)) this.gamepadIndex = e.gamepad.index
    this.listeners.forEach((l) => l('connected', e.gamepad.id))
  }

  private onDisconnected = (e: GamepadEvent) => {
    if (e.gamepad.index === this.gamepadIndex) {
      this.gamepadIndex = null
      this.state = { ...EMPTY_INPUT }
      this.edges.clear()
    }
    this.listeners.forEach((l) => l('disconnected', e.gamepad.id))
  }

  /** Selecciona el mando: el DualSense si lo hay; si no, el primero conectado. */
  private findGamepad(): Gamepad | null {
    const pads = Array.from(this.source()).filter((g): g is Gamepad => !!g && g.connected)
    if (pads.length === 0) return null
    const current = pads.find((g) => g.index === this.gamepadIndex)
    const chosen = current ?? pads.find((g) => isDualSense(g.id)) ?? pads[0]
    this.gamepadIndex = chosen.index
    return chosen
  }

  isAvailable(): boolean {
    return this.findGamepad() !== null
  }

  // ─── Lectura ───────────────────────────────────────────────────────────
  /** Valor bruto de una acción analógica, sin calibrar. */
  readRaw(gp: Gamepad, action: AnalogAction): number {
    return readBinding(gp, this.bindings[action])
  }

  /** Calibración + zona muerta (sin suavizado). */
  processAnalog(action: 'clutch' | 'accelerator', raw: number): number {
    const normalized = normalize(raw, this.calibration[action])
    return applyDeadzone(normalized, this.settings[action].deadzone)
  }

  update(dt: number) {
    const gp = this.findGamepad()
    if (!gp) {
      this.diagnostics = emptyDiagnostics()
      this.state = { ...EMPTY_INPUT }
      this.edges.update([])
      return
    }

    const raw = {
      clutch: this.readRaw(gp, 'clutch'),
      accelerator: this.readRaw(gp, 'accelerator'),
      brake: this.readRaw(gp, 'brake'),
    }

    const clutchTarget = this.processAnalog('clutch', raw.clutch)
    const accelTarget = this.processAnalog('accelerator', raw.accelerator)
    const brakeTarget = clamp01(raw.brake)

    const prev = this.state
    const clutch = smooth(prev.clutch, clutchTarget, this.settings.clutch.smoothing, dt)
    const accelerator = smooth(prev.accelerator, accelTarget, this.settings.accelerator.smoothing, dt)
    // L1 es digital: una rampa corta hace que la frenada sea progresiva.
    const brake = this.isDigital(this.bindings.brake)
      ? rampTowards(prev.brake, brakeTarget, this.settings.digitalBrakeRate, this.settings.digitalBrakeRate * 3, dt)
      : brakeTarget

    const pressed = DIGITAL_ACTIONS.filter((a) => readBinding(gp, this.bindings[a]) > PRESS_THRESHOLD)
    this.edges.update(pressed)

    let selectedGear: InputState['selectedGear'] = null
    for (const [action, gear] of DIRECT_GEAR_ACTIONS) {
      if (this.edges.wasPressed(action)) selectedGear = gear
    }

    this.state = {
      clutch: snap(clutch),
      accelerator: snap(accelerator),
      brake: snap(brake),
      gearUp: this.edges.wasPressed('gearUp'),
      gearDown: this.edges.wasPressed('gearDown'),
      selectedGear,
      start: this.edges.wasPressed('start'),
      pause: this.edges.wasPressed('pause'),
      restart: this.edges.wasPressed('restart'),
    }

    this.diagnostics = {
      connected: true,
      id: gp.id,
      mapping: gp.mapping,
      isDualSense: isDualSense(gp.id),
      axes: Array.from(gp.axes),
      buttons: gp.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
      raw,
      processed: { clutch: this.state.clutch, accelerator: this.state.accelerator, brake: this.state.brake },
    }

    this.runCapture(gp)
  }

  private isDigital(b: GamepadBinding | undefined): boolean {
    // Solo los gatillos (6, 7) y los ejes son analógicos en el mapeo estándar.
    return !!b && b.kind === 'button' && b.index !== 6 && b.index !== 7
  }

  getState(): InputState {
    return this.state
  }

  isHeld(action: ActionId): boolean {
    const gp = this.findGamepad()
    return !!gp && readBinding(gp, this.bindings[action]) > PRESS_THRESHOLD
  }

  getDiagnostics(): GamepadDiagnostics {
    return this.diagnostics
  }

  reset() {
    this.state = { ...EMPTY_INPUT }
  }

  // ─── Reasignación: "pulsa el control que quieras usar" ──────────────────
  captureNext(callback: CaptureCallback) {
    this.capture = { callback, baseline: null }
  }

  cancelCapture() {
    this.capture = null
  }

  isCapturing(): boolean {
    return this.capture !== null
  }

  private runCapture(gp: Gamepad) {
    if (!this.capture) return
    const axes = Array.from(gp.axes)
    const buttons = gp.buttons.map((b) => b.value || (b.pressed ? 1 : 0))
    if (!this.capture.baseline) {
      this.capture.baseline = { axes, buttons }
      return
    }
    const base = this.capture.baseline
    const b = buttons.findIndex((v, i) => v > 0.6 && (base.buttons[i] ?? 0) < 0.3)
    if (b >= 0) return this.finishCapture({ kind: 'button', index: b })
    const a = axes.findIndex((v, i) => Math.abs(v - (base.axes[i] ?? 0)) > 0.6)
    if (a >= 0) {
      const direction = axes[a] - (base.axes[a] ?? 0) > 0 ? 1 : -1
      return this.finishCapture({ kind: 'axis', index: a, direction })
    }
  }

  private finishCapture(binding: GamepadBinding) {
    const cb = this.capture?.callback
    this.capture = null
    cb?.(binding)
  }
}

/** Evita que el suavizado deje colas infinitesimales (0.0003…) en los extremos. */
function snap(v: number): number {
  if (v < 0.001) return 0
  if (v > 0.999) return 1
  return v
}

function emptyDiagnostics(): GamepadDiagnostics {
  return {
    connected: false,
    id: '',
    mapping: '',
    isDualSense: false,
    axes: [],
    buttons: [],
    raw: { clutch: 0, accelerator: 0, brake: 0 },
    processed: { clutch: 0, accelerator: 0, brake: 0 },
  }
}
