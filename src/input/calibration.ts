import type { AxisCalibration, Calibration, GamepadBinding, InputSettings } from './types'

export const DEADZONE = 0.03
export const DEFAULT_SMOOTHING = 0.15

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** normalized = (value - min) / (max - min), limitado a 0–1. */
export function normalize(value: number, cal: AxisCalibration): number {
  const range = cal.max - cal.min
  if (Math.abs(range) < 1e-6) return 0
  return clamp01((value - cal.min) / range)
}

/**
 * Zona muerta inferior. Se reescala el resto del recorrido para que
 * el valor siga llegando a 1 sin saltos.
 */
export function applyDeadzone(value: number, deadzone: number): number {
  if (deadzone <= 0) return clamp01(value)
  if (value <= deadzone) return 0
  return clamp01((value - deadzone) / (1 - deadzone))
}

/**
 * smoothed = previous + (target - previous) · k, con k derivado de `smoothing`
 * (0 = sin suavizado, 1 = máximo) y corregido por dt para no depender del FPS.
 */
export function smooth(previous: number, target: number, smoothing: number, dt: number): number {
  if (smoothing <= 0) return target
  const perFrameAt60 = 1 - Math.min(0.95, smoothing * 0.95)
  const k = 1 - Math.pow(1 - perFrameAt60, dt * 60)
  return previous + (target - previous) * k
}

/** Mueve un valor hacia el objetivo con velocidades de subida/bajada (fracción/s). */
export function rampTowards(current: number, target: number, riseRate: number, fallRate: number, dt: number): number {
  if (target > current) return Math.min(target, current + riseRate * dt)
  return Math.max(target, current - fallRate * dt)
}

/** Calibración por defecto según el tipo de control asignado. */
export function defaultAxisCalibration(binding: GamepadBinding | undefined): AxisCalibration {
  if (binding?.kind === 'axis') return { min: -1, max: 1 }
  return { min: 0, max: 1 }
}

export function defaultCalibration(): Calibration {
  return { clutch: { min: 0, max: 1 }, accelerator: { min: 0, max: 1 }, calibrated: false }
}

export const DEFAULT_INPUT_SETTINGS: InputSettings = {
  clutch: { deadzone: DEADZONE, smoothing: DEFAULT_SMOOTHING },
  accelerator: { deadzone: DEADZONE, smoothing: DEFAULT_SMOOTHING },
  keyboardPressRate: 1.6,
  keyboardReleaseRate: 2.5,
  keyboardClutchReleaseRate: 0.3,
  digitalBrakeRate: 1.6,
}

