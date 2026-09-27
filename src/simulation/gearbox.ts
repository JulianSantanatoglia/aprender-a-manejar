import {
  CLUTCH_PRESSED_THRESHOLD,
  FINAL_DRIVE,
  GEAR_RATIOS,
  NO_CLUTCH_ENGAGEMENT,
  REVERSE_MAX_SPEED_KMH,
} from './constants'
import type { Gear } from './types'

/** Relación total (caja × grupo). 0 en neutral, negativa en marcha atrás. */
export function totalRatio(gear: Gear): number {
  if (gear === 'N') return 0
  return GEAR_RATIOS[gear] * FINAL_DRIVE
}

export function gearLabel(gear: Gear): string {
  return String(gear)
}

/** Secuencia usada por el modo secuencial (D-pad). */
const SEQUENCE: readonly Gear[] = ['R', 'N', 1, 2, 3, 4, 5]

export function nextGearUp(gear: Gear): Gear | null {
  const i = SEQUENCE.indexOf(gear)
  return i < SEQUENCE.length - 1 ? SEQUENCE[i + 1] : null
}

export function nextGearDown(gear: Gear): Gear | null {
  const i = SEQUENCE.indexOf(gear)
  return i > 0 ? SEQUENCE[i - 1] : null
}

export interface ShiftContext {
  speedKmh: number
  clutchPedal: number
  clutchEngagement: number
}

export type ShiftResult =
  | { ok: true; to: Gear; noClutch: boolean }
  | { ok: false; to: Gear; reason: string }

/**
 * Valida un cambio. Los cambios sin embrague se permiten (con penalización
 * aplicada por el motor de simulación), pero nunca los imposibles.
 */
export function requestShift(from: Gear, to: Gear, ctx: ShiftContext): ShiftResult {
  if (from === to) return { ok: false, to, reason: 'Ya estás en esa marcha.' }

  const stopped = Math.abs(ctx.speedKmh) <= REVERSE_MAX_SPEED_KMH

  if (to === 'R') {
    if (!stopped) return { ok: false, to, reason: 'Detén el vehículo antes de meter la marcha atrás.' }
    if (ctx.clutchPedal < CLUTCH_PRESSED_THRESHOLD)
      return { ok: false, to, reason: 'Pisa el embrague a fondo para meter la marcha atrás.' }
    return { ok: true, to, noClutch: false }
  }

  if (typeof to === 'number') {
    // Meter una marcha hacia delante mientras el coche va hacia atrás (o al revés con R) no es posible.
    if (ctx.speedKmh < -REVERSE_MAX_SPEED_KMH)
      return { ok: false, to, reason: 'Detén el vehículo antes de meter una marcha hacia delante.' }
  }

  const noClutch = to !== 'N' && ctx.clutchEngagement > NO_CLUTCH_ENGAGEMENT
  return { ok: true, to, noClutch }
}
