import { DEFAULT_INPUT_SETTINGS, rampTowards } from './calibration'
import { DEFAULT_KEYBOARD_BINDINGS } from './GamepadMapping'
import { EdgeTracker, type InputDevice } from './InputDevice'
import {
  DIRECT_GEAR_ACTIONS,
  EMPTY_INPUT,
  type ActionId,
  type DigitalAction,
  type InputSettings,
  type InputState,
  type KeyboardBindings,
} from './types'

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

type CaptureCallback = (code: string | null) => void

/**
 * Teclado como alternativa al mando. Los pedales simulan progresividad:
 * mientras la tecla está pulsada suben, al soltarla bajan, siempre en
 * función de deltaTime (no de la repetición del teclado ni de los FPS).
 */
export class KeyboardInput implements InputDevice {
  readonly kind = 'keyboard' as const
  private held = new Set<string>()
  private bindings: KeyboardBindings = { ...DEFAULT_KEYBOARD_BINDINGS }
  private settings: InputSettings = DEFAULT_INPUT_SETTINGS
  private edges = new EdgeTracker<DigitalAction>()
  private state: InputState = { ...EMPTY_INPUT }
  /** Pulsaciones que ocurrieron entre dos frames (pulsar y soltar muy rápido). */
  private tapped = new Set<string>()
  private capture: CaptureCallback | null = null
  private attached = false

  setBindings(b: KeyboardBindings) {
    this.bindings = { ...b }
  }
  getBindings(): KeyboardBindings {
    return this.bindings
  }
  setSettings(s: InputSettings) {
    this.settings = s
  }

  attach() {
    if (this.attached || typeof window === 'undefined') return
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    this.attached = true
  }

  detach() {
    if (!this.attached) return
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.attached = false
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.capture) {
      e.preventDefault()
      const cb = this.capture
      this.capture = null
      cb(e.code === 'Escape' ? null : e.code)
      return
    }
    if (isTypingTarget(e.target)) return
    if (this.isBound(e.code)) e.preventDefault()
    if (!e.repeat) this.press(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    // Evita que Espacio/Enter activen el botón con foco al soltar la tecla.
    if (!isTypingTarget(e.target) && this.isBound(e.code)) e.preventDefault()
    this.release(e.code)
  }

  private onBlur = () => {
    this.held.clear()
  }

  private isBound(code: string): boolean {
    return Object.values(this.bindings).some((codes) => codes?.includes(code))
  }

  /** Públicos para poder simular teclas en tests. */
  press(code: string) {
    this.held.add(code)
    this.tapped.add(code)
  }

  release(code: string) {
    this.held.delete(code)
  }

  isAvailable(): boolean {
    return true
  }

  isHeld(action: ActionId): boolean {
    return (this.bindings[action] ?? []).some((c) => this.held.has(c) || this.tapped.has(c))
  }

  update(dt: number) {
    const s = this.settings
    const prev = this.state
    const target = (a: ActionId) => (this.isHeld(a) ? 1 : 0)

    const clutch = rampTowards(prev.clutch, target('clutch'), s.keyboardPressRate, s.keyboardClutchReleaseRate, dt)
    const accelerator = rampTowards(prev.accelerator, target('accelerator'), s.keyboardPressRate, s.keyboardReleaseRate, dt)
    const brake = rampTowards(prev.brake, target('brake'), s.keyboardPressRate, s.keyboardReleaseRate, dt)

    this.edges.update(DIGITAL_ACTIONS.filter((a) => this.isHeld(a)))
    this.tapped.clear()

    let selectedGear: InputState['selectedGear'] = null
    for (const [action, gear] of DIRECT_GEAR_ACTIONS) {
      if (this.edges.wasPressed(action)) selectedGear = gear
    }

    this.state = {
      clutch,
      accelerator,
      brake,
      gearUp: this.edges.wasPressed('gearUp'),
      gearDown: this.edges.wasPressed('gearDown'),
      selectedGear,
      start: this.edges.wasPressed('start'),
      pause: this.edges.wasPressed('pause'),
      restart: this.edges.wasPressed('restart'),
    }
  }

  getState(): InputState {
    return this.state
  }

  /** Estado de reposo tras reiniciar: embrague pisado (sección 55). */
  reset() {
    this.state = { ...EMPTY_INPUT, clutch: 1 }
  }

  captureNext(callback: CaptureCallback) {
    this.capture = callback
  }

  cancelCapture() {
    this.capture = null
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'TEXTAREA' || target.isContentEditable) return true
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type
    return type !== 'range' && type !== 'checkbox' && type !== 'radio'
  }
  return tag === 'SELECT'
}
