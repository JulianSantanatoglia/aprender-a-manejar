import { clutchCapacity, clutchCouplingTorque, clutchEngagementFromPedal } from './clutch'
import {
  ABSOLUTE_MAX_RPM,
  CLUTCH_PRESSED_THRESHOLD,
  DEFAULT_VEHICLE_CONFIG,
  ENGINE_INERTIA,
  HARD_STALL_RPM,
  JOLT_FILTER_TAU,
  LIMITER_HYSTERESIS_RPM,
  MAX_FRAME_DT,
  MS_TO_KMH,
  NO_CLUTCH_SPEED_LOSS,
  PHYSICS_STEP,
  RAD_S_TO_RPM,
  RPM_TO_RAD_S,
  STALL_RPM,
  WHEEL_RADIUS_M,
} from './constants'
import { clamp, effectiveThrottle, engineNetTorque, updateLimiter } from './enginePhysics'
import { nextGearDown, nextGearUp, requestShift, totalRatio } from './gearbox'
import {
  applyResistance,
  drivetrainInertia,
  drivetrainRpm,
  gearboxOmegaFromSpeed,
  resistiveForce,
  wheelForceFromClutchTorque,
} from './physics'
import type { DriverControls, Gear, SimulationEvent, VehicleConfig, VehicleTelemetry } from './types'
import { createVehicleTelemetry, type InitialCondition } from './vehicle'

/** Órdenes discretas del conductor en un frame (flancos, no mantenidas). */
export interface DriverCommands {
  gearUp: boolean
  gearDown: boolean
  selectGear: Gear | null
  start: boolean
}

export const NO_COMMANDS: DriverCommands = { gearUp: false, gearDown: false, selectGear: null, start: false }

/** Filtro de primer orden independiente del paso. */
const follow = (current: number, target: number, tau: number, dt: number) =>
  tau <= 0 ? target : current + (target - current) * (1 - Math.exp(-dt / tau))

/**
 * Motor de simulación. No conoce React ni el dispositivo de entrada:
 * recibe `DriverControls` + `DriverCommands` y avanza con paso fijo.
 */
export class SimulationEngine {
  private config: VehicleConfig
  private telemetry: VehicleTelemetry
  private engineOmega = 0
  private speedMs = 0
  private throttlePos = 0
  private engagement = 0
  private accumulator = 0
  private events: SimulationEvent[] = []
  time = 0

  constructor(config: VehicleConfig = DEFAULT_VEHICLE_CONFIG) {
    this.config = { ...config }
    this.telemetry = createVehicleTelemetry(this.config)
    this.reset()
  }

  getConfig(): VehicleConfig {
    return this.config
  }

  setConfig(config: VehicleConfig) {
    this.config = { ...config }
  }

  /** Estado interno (mutable). Copiar antes de exponer fuera. */
  getTelemetry(): Readonly<VehicleTelemetry> {
    return this.telemetry
  }

  drainEvents(): SimulationEvent[] {
    const e = this.events
    this.events = []
    return e
  }

  reset(initial: InitialCondition = {}) {
    const gear = initial.gear ?? 'N'
    const speedKmh = initial.speedKmh ?? 0
    const t = createVehicleTelemetry(this.config)
    t.gear = gear
    t.speedKmh = speedKmh
    this.speedMs = speedKmh / MS_TO_KMH
    const driveRpm = Math.abs(drivetrainRpm(speedKmh, gear))
    t.rpm = Math.max(this.config.idleRpm, driveRpm)
    // En movimiento con marcha metida se parte con el embrague acoplado.
    const moving = gear !== 'N' && speedKmh !== 0
    this.engagement = moving ? 1 : 0
    t.clutchEngagement = this.engagement
    t.clutchPedal = moving ? 0 : 1
    this.engineOmega = t.rpm * RPM_TO_RAD_S
    this.throttlePos = 0
    this.accumulator = 0
    this.telemetry = t
    this.events.push({ type: 'reset' })
  }

  /** Avanza un frame de `frameDt` segundos. */
  update(frameDt: number, controls: DriverControls, commands: DriverCommands = NO_COMMANDS) {
    const t = this.telemetry
    t.clutchPedal = clamp(controls.clutch, 0, 1)
    t.accelerator = clamp(controls.accelerator, 0, 1)
    t.brake = clamp(controls.brake, 0, 1)

    // Primero la palanca y después el arranque: así "✕" (neutral + arranque) arranca en un solo gesto.
    this.handleShiftCommands(commands)
    if (commands.start) this.tryStart()

    this.accumulator += Math.min(Math.max(frameDt, 0), MAX_FRAME_DT)
    while (this.accumulator >= PHYSICS_STEP) {
      this.substep(PHYSICS_STEP)
      this.accumulator -= PHYSICS_STEP
    }
  }

  // ─── Arranque ──────────────────────────────────────────────────────────
  tryStart() {
    const t = this.telemetry
    if (t.engineRunning) return
    if (t.clutchPedal > CLUTCH_PRESSED_THRESHOLD || t.gear === 'N') {
      t.engineRunning = true
      t.stalled = false
      this.engineOmega = this.config.idleRpm * RPM_TO_RAD_S
      t.rpm = this.config.idleRpm
      this.events.push({ type: 'engineStart' })
    } else {
      this.events.push({ type: 'startFailed', reason: 'Pisa el embrague a fondo (o pon punto muerto) para arrancar.' })
    }
  }

  // ─── Caja de cambios ───────────────────────────────────────────────────
  private handleShiftCommands(c: DriverCommands) {
    const g = this.telemetry.gear
    let target: Gear | null = null
    if (c.selectGear !== null) target = c.selectGear
    else if (c.gearUp) target = nextGearUp(g)
    else if (c.gearDown) target = nextGearDown(g)
    if (target === null || target === g) return
    this.shiftTo(target)
  }

  shiftTo(to: Gear) {
    const t = this.telemetry
    const from = t.gear
    const result = requestShift(from, to, {
      speedKmh: t.speedKmh,
      clutchPedal: t.clutchPedal,
      clutchEngagement: this.engagement,
    })
    if (!result.ok) {
      this.events.push({ type: 'gearRejected', to, reason: result.reason })
      return
    }
    if (result.noClutch) {
      // Penalización: tirón y pérdida momentánea de velocidad proporcional al desajuste.
      const mismatch = Math.abs(Math.abs(drivetrainRpm(t.speedKmh, to)) - t.rpm)
      const loss = NO_CLUTCH_SPEED_LOSS * clamp(mismatch / 1500, 0.3, 1)
      this.speedMs *= 1 - loss
    }
    t.gear = to
    this.events.push({
      type: 'gearChange',
      event: {
        from,
        to,
        clutch: t.clutchPedal,
        speed: t.speedKmh,
        rpm: t.rpm,
        noClutch: result.noClutch,
        time: this.time,
      },
    })
  }

  // ─── Física (paso fijo) ────────────────────────────────────────────────
  private substep(dt: number) {
    const t = this.telemetry
    const cfg = this.config
    this.time += dt

    this.throttlePos = follow(this.throttlePos, t.accelerator, cfg.throttleResponse, dt)
    const targetEngagement = clutchEngagementFromPedal(t.clutchPedal, cfg.clutchBitePoint)
    this.engagement = follow(this.engagement, targetEngagement, cfg.clutchResponse, dt)

    const gear = t.gear
    const ratio = totalRatio(gear)
    const inGear = ratio !== 0
    const Iv = drivetrainInertia(cfg.massKg, gear)
    const Ie = ENGINE_INERTIA
    const gearboxOmega = inGear ? gearboxOmegaFromSpeed(this.speedMs, gear) : 0
    const capacity = inGear ? clutchCapacity(this.engagement) : 0

    let rpm = this.engineOmega * RAD_S_TO_RPM
    let throttle = 0
    let engineTorque = 0
    let clutchTorque = 0

    if (t.engineRunning) {
      t.limiterActive = updateLimiter(t.limiterActive, rpm, cfg.redlineRpm, LIMITER_HYSTERESIS_RPM)
      throttle = effectiveThrottle(this.throttlePos, rpm, cfg.idleRpm)
      engineTorque = engineNetTorque(rpm, throttle, cfg.power, t.limiterActive)
      clutchTorque = inGear
        ? clutchCouplingTorque({
            engineOmega: this.engineOmega,
            gearboxOmega,
            engineTorque,
            engineInertia: Ie,
            drivetrainInertia: Iv,
            capacity,
            dt,
          })
        : 0
      this.engineOmega = clamp(
        this.engineOmega + ((engineTorque - clutchTorque) / Ie) * dt,
        0,
        ABSOLUTE_MAX_RPM * RPM_TO_RAD_S,
      )
    } else {
      // Motor parado: el embrague acoplado frena el coche contra el motor inmóvil.
      t.limiterActive = false
      this.engineOmega = 0
      if (inGear && capacity > 0) {
        clutchTorque = clamp((-gearboxOmega * Iv) / dt, -capacity, capacity)
      }
    }

    // Vehículo: fuerza motriz + fuerzas disipativas.
    const prevSpeed = this.speedMs
    const driveForce = inGear ? wheelForceFromClutchTorque(clutchTorque, gear) : 0
    this.speedMs += (driveForce / cfg.massKg) * dt
    const resist = resistiveForce(this.speedMs, cfg.massKg, t.brake, cfg.brakeForceN, cfg.resistance)
    this.speedMs = applyResistance(this.speedMs, resist, cfg.massKg, dt)

    // Métrica de brusquedad: par del embrague que no procede del reparto suave del par motor.
    let joltRaw = 0
    if (inGear && capacity > 0) {
      const smoothShare = t.engineRunning ? (engineTorque * Iv) / (Ie + Iv) : 0
      joltRaw = (Math.abs(clutchTorque - smoothShare) * Math.abs(ratio)) / WHEEL_RADIUS_M / cfg.massKg
    }
    t.jolt = follow(t.jolt, joltRaw, JOLT_FILTER_TAU, dt)

    rpm = this.engineOmega * RAD_S_TO_RPM
    t.rpm = rpm
    t.throttle = throttle
    t.engineTorque = engineTorque
    t.clutchTorque = clutchTorque
    t.clutchCapacity = capacity
    t.clutchEngagement = this.engagement
    t.drivetrainRpm = gearboxOmega * RAD_S_TO_RPM
    t.clutchSlipRpm = inGear ? rpm - t.drivetrainRpm : 0
    t.wheelTorque = clutchTorque * ratio
    t.accelerationMs2 = follow(t.accelerationMs2, (this.speedMs - prevSpeed) / dt, 0.05, dt)
    t.speedKmh = this.speedMs * MS_TO_KMH
    t.distanceMeters += Math.abs(this.speedMs) * dt
    t.positionMeters += this.speedMs * dt

    this.checkStall()
  }

  private checkStall() {
    const t = this.telemetry
    if (!t.engineRunning) return
    const loaded = t.gear !== 'N' && this.engagement > 0.25
    if (t.rpm < HARD_STALL_RPM || (loaded && t.rpm < STALL_RPM)) {
      t.engineRunning = false
      t.stalled = true
      t.rpm = 0
      t.limiterActive = false
      this.engineOmega = 0
      this.events.push({ type: 'stall', speedKmh: t.speedKmh, gear: t.gear })
    }
  }
}
