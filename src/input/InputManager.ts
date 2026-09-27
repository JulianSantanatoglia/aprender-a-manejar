import { GamepadInput } from './GamepadInput'
import type { InputDevice } from './InputDevice'
import { KeyboardInput } from './KeyboardInput'
import { EMPTY_INPUT, type DeviceKind, type DevicePreference, type InputState } from './types'

export type DeviceEvent =
  | { type: 'gamepadConnected'; id: string }
  | { type: 'gamepadDisconnected'; id: string; fallback: boolean }

/**
 * Único punto del que la simulación obtiene el `InputState`.
 * - Elige automáticamente el mando si está conectado, si no el teclado.
 * - Los pedales vienen solo del dispositivo activo.
 * - Las órdenes discretas (pausa, arranque, marchas) se aceptan de ambos,
 *   para que Esc funcione aunque se conduzca con el mando.
 */
export class InputManager {
  readonly gamepad: GamepadInput
  readonly keyboard: KeyboardInput
  private activeDevice: InputDevice
  private preference: DevicePreference = 'auto'
  private state: InputState = { ...EMPTY_INPUT }
  private listeners = new Set<(e: DeviceEvent) => void>()
  private unsubscribe: (() => void) | null = null

  constructor(gamepad = new GamepadInput(), keyboard = new KeyboardInput()) {
    this.gamepad = gamepad
    this.keyboard = keyboard
    this.activeDevice = keyboard
  }

  attach() {
    this.gamepad.attach()
    this.keyboard.attach()
    this.unsubscribe = this.gamepad.onConnection((type, id) => {
      if (type === 'connected') this.emit({ type: 'gamepadConnected', id })
      else this.emit({ type: 'gamepadDisconnected', id, fallback: this.preference !== 'gamepad' })
    })
  }

  detach() {
    this.gamepad.detach()
    this.keyboard.detach()
    this.unsubscribe?.()
  }

  onDeviceEvent(listener: (e: DeviceEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(e: DeviceEvent) {
    this.listeners.forEach((l) => l(e))
  }

  setPreference(p: DevicePreference) {
    this.preference = p
  }

  getPreference(): DevicePreference {
    return this.preference
  }

  setDevice(device: InputDevice) {
    this.activeDevice = device
  }

  getActiveKind(): DeviceKind {
    return this.activeDevice.kind
  }

  update(dt: number) {
    this.gamepad.update(dt)
    this.keyboard.update(dt)

    const gamepadAvailable = this.gamepad.getDiagnostics().connected
    if (this.preference === 'keyboard') this.setDevice(this.keyboard)
    else if (this.preference === 'gamepad') this.setDevice(this.gamepad)
    else this.setDevice(gamepadAvailable ? this.gamepad : this.keyboard)

    const active = this.activeDevice.getState()
    const other = (this.activeDevice === this.gamepad ? this.keyboard : this.gamepad).getState()
    this.state = {
      clutch: active.clutch,
      accelerator: active.accelerator,
      brake: active.brake,
      gearUp: active.gearUp || other.gearUp,
      gearDown: active.gearDown || other.gearDown,
      selectedGear: active.selectedGear ?? other.selectedGear,
      start: active.start || other.start,
      pause: active.pause || other.pause,
      restart: active.restart || other.restart,
    }
  }

  getState(): InputState {
    return this.state
  }

  reset() {
    this.gamepad.reset()
    this.keyboard.reset()
  }
}
