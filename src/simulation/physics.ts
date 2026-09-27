import {
  AIR_DRAG_COEF,
  GRAVITY,
  MS_TO_KMH,
  RAD_S_TO_RPM,
  ROLLING_RESISTANCE_COEF,
  WHEEL_RADIUS_M,
} from './constants'
import { totalRatio } from './gearbox'
import type { Gear } from './types'

/**
 * Cadena cinemática (sección 77):
 *   velocidad → giro de rueda → relación total → giro en el embrague → RPM
 */
export function gearboxOmegaFromSpeed(speedMs: number, gear: Gear): number {
  return (speedMs / WHEEL_RADIUS_M) * totalRatio(gear)
}

export function drivetrainRpm(speedKmh: number, gear: Gear): number {
  return gearboxOmegaFromSpeed(speedKmh / MS_TO_KMH, gear) * RAD_S_TO_RPM
}

/** Velocidad (km/h) correspondiente a unas RPM en una marcha. */
export function speedForRpm(rpm: number, gear: Gear): number {
  const ratio = totalRatio(gear)
  if (ratio === 0) return 0
  return ((rpm / RAD_S_TO_RPM / ratio) * WHEEL_RADIUS_M) * MS_TO_KMH
}

/** Inercia de la masa del vehículo vista desde el embrague, kg·m². */
export function drivetrainInertia(massKg: number, gear: Gear): number {
  const g = totalRatio(gear)
  if (g === 0) return Infinity
  return (massKg * WHEEL_RADIUS_M * WHEEL_RADIUS_M) / (g * g)
}

/** Fuerza en la rueda (N) a partir del par que atraviesa el embrague. */
export function wheelForceFromClutchTorque(clutchTorque: number, gear: Gear): number {
  return (clutchTorque * totalRatio(gear)) / WHEEL_RADIUS_M
}

/** Suma de fuerzas que siempre se oponen al movimiento (N, positiva). */
export function resistiveForce(speedMs: number, massKg: number, brake: number, brakeForceN: number, resistance: number): number {
  const rolling = ROLLING_RESISTANCE_COEF * massKg * GRAVITY
  const air = AIR_DRAG_COEF * speedMs * speedMs
  return (rolling + air) * resistance + Math.max(0, Math.min(1, brake)) * brakeForceN
}

/**
 * Aplica fuerzas disipativas (rodadura, aire, freno) sin que puedan
 * invertir el sentido de la marcha: si bastan para detener el coche,
 * la velocidad queda exactamente en 0 (se comportan como fricción estática).
 */
export function applyResistance(speedMs: number, resistiveN: number, massKg: number, dt: number): number {
  const dv = (resistiveN / massKg) * dt
  if (Math.abs(speedMs) <= dv) return 0
  return speedMs - Math.sign(speedMs) * dv
}
