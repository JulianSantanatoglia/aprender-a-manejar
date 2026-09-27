import { RPM_LUGGING } from '../simulation/constants'
import type { GearChangeEvent, VehicleTelemetry } from '../simulation/types'
import type { Quality, ShiftEvaluation } from './types'

/** Umbrales de brusquedad (m/s²). */
export const JOLT_SMOOTH = 1.5
export const JOLT_ACCEPTABLE = 3
export const JOLT_ROUGH = 5

const TIMEOUT_S = 6
const NO_CLUTCH_WINDOW_S = 0.5

export function classifyJolt(jolt: number): Quality {
  if (jolt < JOLT_SMOOTH) return 'smooth'
  if (jolt < JOLT_ACCEPTABLE) return 'acceptable'
  if (jolt < JOLT_ROUGH) return 'rough'
  return 'bad'
}

const ORDER: Quality[] = ['smooth', 'acceptable', 'rough', 'bad']
const worst = (a: Quality, b: Quality): Quality => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b)

interface Pending {
  event: GearChangeEvent
  startedAt: number
  releaseStart: number | null
  maxJolt: number
  minSpeed: number
}

/**
 * Evalúa cada cambio entre marchas de avance con el coche en movimiento:
 * RPM antes/después, tiempo de liberación del embrague, brusquedad y pérdida de velocidad.
 */
export class ShiftAnalyzer {
  private pending: Pending | null = null

  onGearChange(event: GearChangeEvent, t: VehicleTelemetry, time: number) {
    const between = typeof event.from === 'number' && typeof event.to === 'number'
    if (!between || Math.abs(t.speedKmh) < 3) {
      this.pending = null
      return
    }
    this.pending = { event, startedAt: time, releaseStart: null, maxJolt: 0, minSpeed: Math.abs(t.speedKmh) }
  }

  onStall(t: VehicleTelemetry): ShiftEvaluation | null {
    if (!this.pending) return null
    const p = this.pending
    this.pending = null
    return this.build(p, t, 0, 'bad', true)
  }

  cancel() {
    this.pending = null
  }

  update(t: VehicleTelemetry, time: number, redlineRpm: number): ShiftEvaluation | null {
    const p = this.pending
    if (!p) return null

    if (time - p.startedAt > TIMEOUT_S) {
      this.pending = null
      return null
    }

    p.minSpeed = Math.min(p.minSpeed, Math.abs(t.speedKmh))

    if (p.event.noClutch) {
      p.maxJolt = Math.max(p.maxJolt, t.jolt)
      if (time - p.startedAt < NO_CLUTCH_WINDOW_S) return null
      this.pending = null
      return this.finish(p, t, 0, redlineRpm)
    }

    if (p.releaseStart === null) {
      if (t.clutchEngagement > 0.05) p.releaseStart = time
      else return null
    }
    p.maxJolt = Math.max(p.maxJolt, t.jolt)

    if (t.clutchEngagement >= 0.95 && Math.abs(t.clutchSlipRpm) < 80) {
      this.pending = null
      return this.finish(p, t, time - p.releaseStart, redlineRpm)
    }
    return null
  }

  private finish(p: Pending, t: VehicleTelemetry, releaseTime: number, redlineRpm: number): ShiftEvaluation {
    let quality = classifyJolt(p.maxJolt)
    if (p.event.noClutch) quality = worst(quality, 'rough')
    if (t.rpm > redlineRpm - 300) quality = worst(quality, 'rough')
    else if (t.rpm < RPM_LUGGING) quality = worst(quality, 'acceptable')
    return this.build(p, t, releaseTime, quality, false)
  }

  private build(p: Pending, t: VehicleTelemetry, releaseTime: number, quality: Quality, stalled: boolean): ShiftEvaluation {
    const e = p.event
    const kind = (e.to as number) > (e.from as number) ? 'upshift' : 'downshift'
    const evaluation: ShiftEvaluation = {
      from: e.from,
      to: e.to,
      kind,
      quality,
      rpmBefore: e.rpm,
      rpmAfter: t.rpm,
      clutchReleaseTime: releaseTime,
      jolt: p.maxJolt,
      speedLoss: Math.max(0, Math.abs(e.speed) - p.minSpeed),
      noClutch: e.noClutch,
      stalled,
      message: '',
    }
    evaluation.message = shiftMessage(evaluation)
    return evaluation
  }
}

export function shiftMessage(e: ShiftEvaluation): string {
  if (e.stalled) return 'El motor se ha calado durante el cambio: la marcha era demasiado larga para esa velocidad.'
  if (e.noClutch) return '⚠ Cambio sin embrague. Pisa el embrague a fondo antes de mover la palanca.'
  if (e.rpmAfter < RPM_LUGGING && e.quality !== 'bad')
    return 'Cambio demasiado pronto: las RPM han quedado muy bajas. Espera a unas 2.500 RPM antes de subir.'
  if (e.quality === 'smooth') return e.kind === 'downshift' ? 'Reducción suave.' : 'Cambio suave.'
  if (e.quality === 'acceptable')
    return e.kind === 'downshift' ? 'Reducción correcta, con un pequeño tirón.' : 'Cambio correcto, con un pequeño tirón.'
  if (e.kind === 'downshift' && e.rpmAfter - e.rpmBefore > 800)
    return 'La reducción ha provocado un aumento brusco de RPM. Suelta el embrague más progresivamente.'
  if (e.rpmAfter > 6000) return 'Cambio con RPM demasiado altas. Cambia antes o suelta el embrague más despacio.'
  return 'Cambio brusco. Intenta liberar el embrague más progresivamente.'
}
