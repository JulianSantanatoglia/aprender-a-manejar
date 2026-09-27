import type { ForwardGear, VehicleConfig } from './types'

// ─── Motor ────────────────────────────────────────────────────────────────
export const IDLE_RPM = 800
export const REDLINE_RPM = 6500
export const MAX_RPM = 7000

/** Punto (RPM, Nm) de la curva de par a plena carga. Se interpola linealmente. */
export const TORQUE_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [400, 25],
  [800, 50],
  [1200, 90],
  [1800, 130],
  [2500, 160],
  [3500, 175],
  [4500, 160],
  [5500, 135],
  [6500, 90],
  [7000, 60],
]

/** Inercia del motor + volante, kg·m². */
export const ENGINE_INERTIA = 0.3
/** Pérdidas internas: FRICTION_BASE + FRICTION_QUAD · (rpm/1000)², Nm. */
export const ENGINE_FRICTION_BASE = 6
export const ENGINE_FRICTION_QUAD = 1.6
/** Con mariposa cerrada, las pérdidas por bombeo multiplican la fricción por (1 + este valor). */
export const ENGINE_PUMPING_LOSS = 1.0
/**
 * A bajas RPM una apertura pequeña ya llena los cilindros.
 * fracción de par = acelerador · (1 + THROTTLE_LOW_RPM_GAIN · 1000 / rpm), limitada a 1.
 */
export const THROTTLE_LOW_RPM_GAIN = 4
/** Mariposa base del ralentí y ganancia del regulador. */
export const IDLE_BASE_THROTTLE = 0.08
export const IDLE_GOVERNOR_GAIN = 0.0009
export const IDLE_GOVERNOR_MAX = 0.5
/** Por debajo de estas RPM el motor se cala (con carga) o siempre. */
export const STALL_RPM = 500
export const HARD_STALL_RPM = 250
/** El limitador corta hasta bajar esta cantidad de RPM. */
export const LIMITER_HYSTERESIS_RPM = 250
/** Límite físico absoluto (sobrerrevolución forzada por las ruedas). */
export const ABSOLUTE_MAX_RPM = 9000

// ─── Transmisión ──────────────────────────────────────────────────────────
export const GEAR_RATIOS: Readonly<Record<ForwardGear | 'R', number>> = {
  R: -3.2,
  1: 3.6,
  2: 2.1,
  3: 1.4,
  4: 1.0,
  5: 0.8,
}
export const FINAL_DRIVE = 3.4
export const WHEEL_RADIUS_M = 0.3

// ─── Embrague ─────────────────────────────────────────────────────────────
export const CLUTCH_BITE_POINT = 0.65
/** El embrague empieza a transmitir este tramo por encima del punto de fricción. */
export const CLUTCH_ENGAGE_ABOVE_BITE = 0.1
/** El embrague está totalmente acoplado este tramo por debajo del punto de fricción. */
export const CLUTCH_FULL_BELOW_BITE = 0.4
/** Par máximo del embrague acoplado, Nm (mayor que el del motor → no patina). */
export const CLUTCH_MAX_TORQUE = 350
/** Exponente de la curva capacidad/acoplamiento (progresividad). */
export const CLUTCH_CAPACITY_EXPONENT = 2
/** Zona que se destaca como "punto de fricción" en la UI (± sobre el bite point). */
export const FRICTION_ZONE_HALF_WIDTH = 0.08
/** Pedal mínimo para considerar el embrague "pisado" (cambios, arranque). */
export const CLUTCH_PRESSED_THRESHOLD = 0.8
/** Con acoplamiento superior a esto un cambio se considera "sin embrague". */
export const NO_CLUTCH_ENGAGEMENT = 0.3

// ─── Vehículo ─────────────────────────────────────────────────────────────
export const VEHICLE_MASS_KG = 1200
export const GRAVITY = 9.81
export const ROLLING_RESISTANCE_COEF = 0.012
/** 0.5 · densidad del aire · Cd · A. */
export const AIR_DRAG_COEF = 0.42
export const BRAKE_FORCE_N = 11000
/** Por debajo de esta velocidad (km/h) el vehículo se considera detenido. */
export const STOP_SPEED_KMH = 1
/** Velocidad máxima para seleccionar marcha atrás (km/h). */
export const REVERSE_MAX_SPEED_KMH = 1.5
/** Pérdida de velocidad aplicada al cambiar sin embrague (fracción). */
export const NO_CLUTCH_SPEED_LOSS = 0.05

// ─── Simulación ───────────────────────────────────────────────────────────
/** Paso fijo de física, s. */
export const PHYSICS_STEP = 1 / 500
/** dt máximo por frame (evita saltos al volver de otra pestaña). */
export const MAX_FRAME_DT = 0.1
/** Filtro de la métrica de brusquedad, s. */
export const JOLT_FILTER_TAU = 0.03
/** Frecuencia de actualización de la UI (snapshots a React), Hz. */
export const UI_UPDATE_HZ = 30

// ─── Zonas del tacómetro ──────────────────────────────────────────────────
export const RPM_USEFUL_MIN = 1500
export const RPM_USEFUL_MAX = 4500
export const RPM_LOW_WARNING = 1000
export const RPM_LUGGING = 1200

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  idleRpm: IDLE_RPM,
  redlineRpm: REDLINE_RPM,
  maxRpm: MAX_RPM,
  power: 1,
  massKg: VEHICLE_MASS_KG,
  brakeForceN: BRAKE_FORCE_N,
  resistance: 1,
  clutchBitePoint: CLUTCH_BITE_POINT,
  throttleResponse: 0.06,
  clutchResponse: 0.02,
}

export const MS_TO_KMH = 3.6
export const RAD_S_TO_RPM = 60 / (2 * Math.PI)
export const RPM_TO_RAD_S = (2 * Math.PI) / 60
