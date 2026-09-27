import type { VehicleTelemetry } from '../simulation/types'
import type { LaunchEvaluation, Quality } from './types'

interface Active {
  start: number
  moveAt: number | null
  maxRpm: number
  minRpm: number
  frictionTime: number
  accelSum: number
  samples: number
  maxJolt: number
  gear: VehicleTelemetry['gear']
}

/**
 * Evalúa las salidas desde parado (sección 73): desde que el embrague empieza
 * a morder con el coche detenido hasta que queda acoplado sin patinar.
 */
export class LaunchAnalyzer {
  private active: Active | null = null

  isActive(): boolean {
    return this.active !== null
  }

  cancel() {
    this.active = null
  }

  onStall(): LaunchEvaluation | null {
    if (!this.active) return null
    const a = this.active
    this.active = null
    return this.build(a, 'bad', true)
  }

  update(t: VehicleTelemetry, time: number, dt: number): LaunchEvaluation | null {
    const stopped = Math.abs(t.speedKmh) < 0.5
    const inGear = t.gear !== 'N'

    if (!this.active) {
      if (t.engineRunning && stopped && inGear && t.clutchEngagement > 0.02) {
        this.active = {
          start: time,
          moveAt: null,
          maxRpm: t.rpm,
          minRpm: t.rpm,
          frictionTime: 0,
          accelSum: 0,
          samples: 0,
          maxJolt: 0,
          gear: t.gear,
        }
      }
      return null
    }

    const a = this.active
    // Intento abandonado: vuelve a pisar el embrague, quita la marcha o sigue parado mucho tiempo.
    if ((stopped && t.clutchEngagement < 0.01) || !inGear || t.gear !== a.gear || (stopped && time - a.start > 15)) {
      this.active = null
      return null
    }

    a.maxRpm = Math.max(a.maxRpm, t.rpm)
    a.minRpm = Math.min(a.minRpm, t.rpm)
    a.accelSum += t.accelerator
    a.samples++
    a.maxJolt = Math.max(a.maxJolt, t.jolt)
    if (t.clutchEngagement > 0.02 && t.clutchEngagement < 0.95 && Math.abs(t.clutchSlipRpm) > 80) a.frictionTime += dt
    if (a.moveAt === null && Math.abs(t.speedKmh) > 1) a.moveAt = time

    if (t.clutchEngagement >= 0.95 && Math.abs(t.clutchSlipRpm) < 80 && !stopped) {
      this.active = null
      const avgAccel = a.samples ? a.accelSum / a.samples : 0
      return this.build(a, classifyLaunch(a, avgAccel), false, time)
    }
    return null
  }

  private build(a: Active, quality: Quality, stalled: boolean, time?: number): LaunchEvaluation {
    const avgAccelerator = a.samples ? a.accelSum / a.samples : 0
    const e: LaunchEvaluation = {
      gear: a.gear,
      quality,
      timeToMove: a.moveAt !== null ? a.moveAt - a.start : time !== undefined ? time - a.start : 0,
      maxRpm: a.maxRpm,
      minRpm: a.minRpm,
      frictionTime: a.frictionTime,
      avgAccelerator,
      jolt: a.maxJolt,
      stalled,
      message: '',
    }
    e.message = launchMessage(e)
    return e
  }
}

/** Umbrales de brusquedad en salidas (m/s²): una salida siempre tiene algo de empuje. */
const LAUNCH_JOLT_ACCEPTABLE = 2
const LAUNCH_JOLT_ROUGH = 3.5
const LAUNCH_JOLT_BAD = 5.5

function classifyLaunch(a: Active, avgAccel: number): Quality {
  if (avgAccel > 0.7 || a.maxRpm > 4500) return 'rough'
  if (a.maxJolt >= LAUNCH_JOLT_BAD) return 'bad'
  if (a.maxJolt >= LAUNCH_JOLT_ROUGH || a.frictionTime < 0.4) return 'rough'
  if (a.minRpm < 650 || a.maxJolt >= LAUNCH_JOLT_ACCEPTABLE) return 'acceptable'
  return 'smooth'
}

export function launchMessage(e: LaunchEvaluation): string {
  if (e.stalled) {
    if (e.frictionTime < 0.6) return 'Has soltado demasiado rápido el embrague.'
    if (e.avgAccelerator < 0.08) return 'Las RPM han caído demasiado: acelera un poco (15–25 %) al llegar al punto de fricción.'
    return 'Motor calado durante la salida. Mantén el pedal en el punto de fricción un poco más.'
  }
  if (e.avgAccelerator > 0.7 || e.maxRpm > 4500) return 'Salida brusca. Intenta utilizar menos acelerador.'
  if (e.quality === 'bad' || e.quality === 'rough') return 'Has soltado demasiado rápido el embrague.'
  if (e.quality === 'acceptable')
    return e.minRpm < 650
      ? 'Salida correcta, pero las RPM han bajado mucho. Pasa algo más de acelerador.'
      : 'Salida correcta, con un pequeño tirón al final.'
  return 'Salida correcta. Buena coordinación entre embrague y acelerador.'
}
