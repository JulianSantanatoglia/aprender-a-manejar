import type { DeviceKind, InputState } from './types'

/** Contrato común de todos los dispositivos de entrada. */
export interface InputDevice {
  readonly kind: DeviceKind
  /** Lee el hardware y avanza rampas/suavizados. Llamar una vez por frame. */
  update(dt: number): void
  getState(): InputState
  isAvailable(): boolean
  /** Devuelve el dispositivo a su estado de reposo (reinicio de la simulación). */
  reset(): void
}

/**
 * Distingue "pulsado" (mantenido) de "se acaba de pulsar" / "se acaba de soltar".
 * Se alimenta una vez por frame con el estado actual de cada control.
 */
export class EdgeTracker<K> {
  private previous = new Set<K>()
  private current = new Set<K>()

  update(pressed: Iterable<K>) {
    this.previous = this.current
    this.current = new Set(pressed)
  }

  isPressed(key: K): boolean {
    return this.current.has(key)
  }

  wasPressed(key: K): boolean {
    return this.current.has(key) && !this.previous.has(key)
  }

  wasReleased(key: K): boolean {
    return !this.current.has(key) && this.previous.has(key)
  }

  clear() {
    this.previous.clear()
    this.current.clear()
  }
}
