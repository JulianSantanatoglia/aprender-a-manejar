import {
  ENGINE_FRICTION_BASE,
  ENGINE_FRICTION_QUAD,
  ENGINE_PUMPING_LOSS,
  IDLE_BASE_THROTTLE,
  IDLE_GOVERNOR_GAIN,
  IDLE_GOVERNOR_MAX,
  THROTTLE_LOW_RPM_GAIN,
  TORQUE_CURVE,
} from './constants'

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Par máximo (plena carga) a unas RPM dadas, interpolando la curva. */
export function fullLoadTorque(rpm: number, power = 1): number {
  const curve = TORQUE_CURVE
  if (rpm <= curve[0][0]) return curve[0][1] * power
  for (let i = 1; i < curve.length; i++) {
    const [r1, t1] = curve[i]
    if (rpm <= r1) {
      const [r0, t0] = curve[i - 1]
      const k = (rpm - r0) / (r1 - r0)
      return (t0 + (t1 - t0) * k) * power
    }
  }
  return curve[curve.length - 1][1] * power
}

/** Fracción del par a plena carga disponible con una apertura de mariposa dada. */
export function throttleTorqueFraction(throttle: number, rpm: number): number {
  if (throttle <= 0) return 0
  const r = Math.max(rpm, 300)
  return clamp(throttle * (1 + (THROTTLE_LOW_RPM_GAIN * 1000) / r), 0, 1)
}

/** Pérdidas internas del motor (fricción + bombeo), siempre positivas, Nm. */
export function engineFriction(rpm: number, throttle: number): number {
  if (rpm <= 0) return 0
  const k = rpm / 1000
  const base = ENGINE_FRICTION_BASE + ENGINE_FRICTION_QUAD * k * k
  return base * (1 + ENGINE_PUMPING_LOSS * (1 - clamp(throttle, 0, 1)))
}

/**
 * Regulador de ralentí: mariposa mínima que el motor abre por sí solo
 * para mantener las RPM de ralentí.
 */
export function idleGovernorThrottle(rpm: number, idleRpm: number): number {
  return clamp(IDLE_BASE_THROTTLE + (idleRpm - rpm) * IDLE_GOVERNOR_GAIN, 0, IDLE_GOVERNOR_MAX)
}

/**
 * Mariposa efectiva: la del conductor más la que añade el regulador de ralentí
 * (que actúa como un pequeño antical cuando las RPM caen por debajo del ralentí).
 */
export function effectiveThrottle(pedalThrottle: number, rpm: number, idleRpm: number): number {
  const pedal = clamp(pedalThrottle, 0, 1)
  return clamp(pedal + idleGovernorThrottle(rpm, idleRpm) * (1 - pedal), 0, 1)
}

/** Par neto del motor en marcha, Nm. `cutFuel` = limitador activo. */
export function engineNetTorque(rpm: number, throttle: number, power: number, cutFuel: boolean): number {
  const combustion = cutFuel ? 0 : fullLoadTorque(rpm, power) * throttleTorqueFraction(throttle, rpm)
  return combustion - engineFriction(rpm, cutFuel ? 0 : throttle)
}

/** Actualiza el estado del limitador con histéresis. */
export function updateLimiter(active: boolean, rpm: number, redline: number, hysteresis: number): boolean {
  if (rpm >= redline) return true
  if (active && rpm > redline - hysteresis) return true
  return false
}
