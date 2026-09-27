import type { Gear, VehicleConfig, VehicleTelemetry } from './types'

/** Estado inicial (sección 17): motor encendido, ralentí, N, embrague pisado. */
export function createVehicleTelemetry(config: VehicleConfig): VehicleTelemetry {
  return {
    engineRunning: true,
    speedKmh: 0,
    rpm: config.idleRpm,
    gear: 'N',
    clutchPedal: 1,
    clutchEngagement: 0,
    accelerator: 0,
    brake: 0,
    stalled: false,
    distanceMeters: 0,
    throttle: 0,
    engineTorque: 0,
    clutchTorque: 0,
    clutchCapacity: 0,
    clutchSlipRpm: 0,
    drivetrainRpm: 0,
    accelerationMs2: 0,
    jolt: 0,
    limiterActive: false,
    wheelTorque: 0,
    positionMeters: 0,
  }
}

/** Situación de partida opcional (ejercicios que empiezan en movimiento). */
export interface InitialCondition {
  gear?: Gear
  speedKmh?: number
}
