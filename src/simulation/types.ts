export type ForwardGear = 1 | 2 | 3 | 4 | 5
export type Gear = 'R' | 'N' | ForwardGear

export const GEARS: readonly Gear[] = ['R', 'N', 1, 2, 3, 4, 5]
export const FORWARD_GEARS: readonly ForwardGear[] = [1, 2, 3, 4, 5]

/** Estado del vehículo tal como lo define la especificación (sección 16). */
export interface VehicleState {
  engineRunning: boolean
  speedKmh: number
  rpm: number
  gear: Gear
  /** Posición del pedal: 1 = pisado a fondo, 0 = suelto. */
  clutchPedal: number
  /** Transmisión del embrague: 0 = desacoplado, 1 = acoplado. */
  clutchEngagement: number
  accelerator: number
  brake: number
  stalled: boolean
  distanceMeters: number
}

/** Datos internos adicionales, útiles para UI, debug y análisis. */
export interface VehicleTelemetry extends VehicleState {
  /** Mariposa efectiva tras respuesta del acelerador y ralentí. */
  throttle: number
  /** Par neto del motor (combustión - pérdidas), Nm. */
  engineTorque: number
  /** Par que atraviesa el embrague, Nm (positivo = motor empuja). */
  clutchTorque: number
  /** Par máximo que puede transmitir el embrague en este instante, Nm. */
  clutchCapacity: number
  /** Diferencia de giro entre motor y caja, RPM. */
  clutchSlipRpm: number
  /** RPM que tendría el motor si el embrague estuviera acoplado. */
  drivetrainRpm: number
  /** Aceleración longitudinal, m/s². */
  accelerationMs2: number
  /** Brusquedad transmitida por el embrague (filtrada), m/s². */
  jolt: number
  limiterActive: boolean
  wheelTorque: number
  /** Posición a lo largo de la ruta, m (negativa si se retrocede desde el inicio). */
  positionMeters: number
}

export interface VehicleConfig {
  idleRpm: number
  redlineRpm: number
  maxRpm: number
  /** Multiplicador sobre la curva de par (1 = curva base). */
  power: number
  massKg: number
  /** Fuerza máxima de frenado, N. */
  brakeForceN: number
  /** Multiplicador sobre resistencia a la rodadura y aerodinámica. */
  resistance: number
  /** Posición del pedal (0–1) en la que el embrague empieza a morder. */
  clutchBitePoint: number
  /** Constante de tiempo del acelerador, s (0 = instantáneo). */
  throttleResponse: number
  /** Constante de tiempo del embrague, s (0 = instantáneo). */
  clutchResponse: number
}

/** Entrada que consume la simulación (ya procesada, independiente del dispositivo). */
export interface DriverControls {
  clutch: number
  accelerator: number
  brake: number
}

export interface GearChangeEvent {
  from: Gear
  to: Gear
  clutch: number
  speed: number
  rpm: number
  noClutch: boolean
  time: number
}

export type SimulationEvent =
  | { type: 'gearChange'; event: GearChangeEvent }
  | { type: 'gearRejected'; to: Gear; reason: string }
  | { type: 'stall'; speedKmh: number; gear: Gear }
  | { type: 'engineStart' }
  | { type: 'startFailed'; reason: string }
  | { type: 'reset' }
