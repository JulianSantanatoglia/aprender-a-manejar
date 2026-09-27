import { CLUTCH_BITE_POINT } from '../simulation/constants'
import type { VehicleTelemetry } from '../simulation/types'
import type { FeedbackMessage, FeedbackTone } from './types'

const MAX_MESSAGES = 5
const MESSAGE_TTL_S = 6

/** Cola de mensajes breves que se muestran bajo el asistente. */
export class FeedbackBus {
  private messages: FeedbackMessage[] = []
  private nextId = 1
  private cooldowns = new Map<string, number>()

  push(text: string, tone: FeedbackTone, time: number, key?: string, cooldown = 0) {
    const k = key ?? text
    const until = this.cooldowns.get(k)
    if (until !== undefined && time < until) return
    if (cooldown > 0) this.cooldowns.set(k, time + cooldown)
    this.messages = [{ id: this.nextId++, text, tone, time }, ...this.messages.filter((m) => m.text !== text)].slice(0, MAX_MESSAGES)
  }

  prune(time: number) {
    const before = this.messages.length
    this.messages = this.messages.filter((m) => time - m.time < MESSAGE_TTL_S)
    return before !== this.messages.length
  }

  list(): FeedbackMessage[] {
    return this.messages
  }

  clear() {
    this.messages = []
    this.cooldowns.clear()
  }
}

const HARD_BRAKE_DECEL = 6.5
const HARD_BRAKE_MIN_S = 0.25

/**
 * Entrenador en tiempo real (sección 40): observa el estado continuamente
 * y genera avisos puntuales con enfriamiento para no saturar.
 */
export class LiveCoach {
  private lastClutch = 1
  private hardBrakeTime = 0
  private inHardBrake = false

  reset() {
    this.lastClutch = 1
    this.hardBrakeTime = 0
    this.inHardBrake = false
  }

  /** Devuelve true si ha empezado una frenada brusca en este frame. */
  update(t: VehicleTelemetry, dt: number, time: number, bus: FeedbackBus, launching: boolean, bitePoint = CLUTCH_BITE_POINT): { hardBrake: boolean } {
    const clutchRate = dt > 0 ? (t.clutchPedal - this.lastClutch) / dt : 0
    this.lastClutch = t.clutchPedal
    const inGear = t.gear !== 'N'
    let hardBrake = false

    if (t.engineRunning && inGear) {
      const nearBite = Math.abs(t.clutchPedal - bitePoint) < 0.18
      if (nearBite && clutchRate < -2.2 && Math.abs(t.speedKmh) < 12)
        bus.push('Estás soltando el embrague demasiado rápido.', 'warning', time, 'clutch-fast', 4)

      if (t.clutchEngagement > 0.3 && t.rpm < 650)
        bus.push(
          'Las RPM están bajando demasiado. Pasa ligeramente más acelerador o vuelve a pisar el embrague.',
          'warning',
          time,
          'near-stall',
          4,
        )

      if (launching && t.rpm > 3500)
        bus.push('Estás acelerando demasiado. Para una salida suave, prueba con menos acelerador.', 'warning', time, 'launch-rpm', 5)

      if (t.brake > 0.1 && t.clutchEngagement > 0.5 && t.rpm < 1000 && Math.abs(t.speedKmh) > 0.5)
        bus.push('⚠ PISA EL EMBRAGUE', 'danger', time, 'press-clutch', 3)
    }

    if (t.limiterActive) bus.push('⚠ REDLINE — sube de marcha o suelta el acelerador.', 'danger', time, 'redline', 4)

    if (t.accelerationMs2 < -HARD_BRAKE_DECEL && t.brake > 0.5) {
      this.hardBrakeTime += dt
      if (!this.inHardBrake && this.hardBrakeTime > HARD_BRAKE_MIN_S) {
        this.inHardBrake = true
        hardBrake = true
        bus.push('Frenada brusca. Anticipa y frena de forma más progresiva.', 'warning', time, 'hard-brake', 3)
      }
    } else if (t.accelerationMs2 > -2) {
      this.hardBrakeTime = 0
      this.inHardBrake = false
    }

    return { hardBrake }
  }
}
