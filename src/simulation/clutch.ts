import {
  CLUTCH_CAPACITY_EXPONENT,
  CLUTCH_ENGAGE_ABOVE_BITE,
  CLUTCH_FULL_BELOW_BITE,
  CLUTCH_MAX_TORQUE,
  FRICTION_ZONE_HALF_WIDTH,
} from './constants'
import { clamp } from './enginePhysics'

/**
 * IMPORTANTE — sentido del embrague:
 *   clutchPedal = 1 → pedal pisado a fondo → engagement = 0 (no transmite)
 *   clutchPedal = 0 → pedal suelto          → engagement = 1 (transmite todo)
 */

/** Pedal a partir del cual empieza a transmitir (por encima de él, recorrido libre). */
export function engageStart(bitePoint: number): number {
  return clamp(bitePoint + CLUTCH_ENGAGE_ABOVE_BITE, 0.05, 1)
}

/** Pedal por debajo del cual está completamente acoplado. */
export function fullEngage(bitePoint: number): number {
  return clamp(bitePoint - CLUTCH_FULL_BELOW_BITE, 0, 0.95)
}

/** Acoplamiento (0–1) en función de la posición del pedal. */
export function clutchEngagementFromPedal(clutchPedal: number, bitePoint: number): number {
  const start = engageStart(bitePoint)
  const full = fullEngage(bitePoint)
  const p = clamp(clutchPedal, 0, 1)
  if (p >= start) return 0
  if (p <= full) return 1
  return (start - p) / (start - full)
}

/** Par máximo transmisible (Nm) para un acoplamiento dado. */
export function clutchCapacity(engagement: number): number {
  const e = clamp(engagement, 0, 1)
  return CLUTCH_MAX_TORQUE * Math.pow(e, CLUTCH_CAPACITY_EXPONENT)
}

export function isInFrictionZone(clutchPedal: number, bitePoint: number): boolean {
  return Math.abs(clutchPedal - bitePoint) <= FRICTION_ZONE_HALF_WIDTH
}

export interface ClutchCouplingInput {
  /** Velocidad angular del motor, rad/s. */
  engineOmega: number
  /** Velocidad angular del lado de la caja (en el eje del embrague), rad/s. */
  gearboxOmega: number
  /** Par neto del motor, Nm. */
  engineTorque: number
  engineInertia: number
  /** Inercia del vehículo reflejada al embrague, kg·m². */
  drivetrainInertia: number
  capacity: number
  dt: number
}

/**
 * Par transmitido por el embrague mediante fricción "implícita":
 * se calcula el par que igualaría ambos giros en este paso y se limita
 * por la capacidad. Si cabe dentro de la capacidad, el embrague queda
 * bloqueado (sin patinar); si no, patina transmitiendo su capacidad.
 * Es estable sea cual sea el paso de integración.
 */
export function clutchCouplingTorque(i: ClutchCouplingInput): number {
  if (i.capacity <= 0) return 0
  const invIe = 1 / i.engineInertia
  const invIv = 1 / i.drivetrainInertia
  const lockTorque =
    ((i.engineOmega - i.gearboxOmega) / i.dt + i.engineTorque * invIe) / (invIe + invIv)
  return clamp(lockTorque, -i.capacity, i.capacity)
}
