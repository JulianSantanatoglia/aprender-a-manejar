import type { VehicleTelemetry } from '../simulation/types'
import { QUALITY_SCORE, type DrivingSession, type LaunchEvaluation, type ShiftEvaluation } from './types'

const GOOD_RPM_MIN = 1200
const GOOD_RPM_MAX = 5000
const SMOOTH_JOLT_LIMIT = 1.5
const SMOOTH_ACCEL_LIMIT = 4.5
const MIN_SAMPLE_S = 3

/** Registra la sesión de entrenamiento y calcula las métricas educativas. */
export class SessionTracker {
  private session: DrivingSession
  private clutchScores: number[] = []
  private rpmGood = 0
  private rpmTotal = 0
  private smoothTime = 0
  private movingTime = 0

  constructor(mode: DrivingSession['mode'] = 'free', exerciseId?: string) {
    this.session = newSession(mode, exerciseId)
  }

  get(): DrivingSession {
    return { ...this.session, ...this.scores() }
  }

  update(t: VehicleTelemetry, dt: number, distanceDelta: number) {
    const s = this.session
    s.duration += dt
    s.maxSpeed = Math.max(s.maxSpeed, Math.abs(t.speedKmh))
    s.maxRPM = Math.max(s.maxRPM, t.rpm)
    s.distanceMeters += distanceDelta

    const moving = Math.abs(t.speedKmh) > 1
    const engaged = t.gear !== 'N' && t.clutchEngagement > 0.9

    // Control de RPM: tiempo con el motor en una zona adecuada mientras transmite par.
    if (!t.engineRunning && t.stalled) {
      this.rpmTotal += dt
    } else if (engaged && (moving || t.rpm < GOOD_RPM_MIN)) {
      this.rpmTotal += dt
      if (t.rpm >= GOOD_RPM_MIN && t.rpm <= GOOD_RPM_MAX && !t.limiterActive) this.rpmGood += dt
    }

    if (moving) {
      this.movingTime += dt
      if (t.jolt < SMOOTH_JOLT_LIMIT && Math.abs(t.accelerationMs2) < SMOOTH_ACCEL_LIMIT) this.smoothTime += dt
    }
  }

  onStall() {
    this.session.stalls++
    this.clutchScores.push(0)
  }

  onGearChange() {
    this.session.gearChanges++
  }

  onShift(e: ShiftEvaluation) {
    if (e.quality === 'smooth' || e.quality === 'acceptable') this.session.smoothChanges++
    else this.session.roughChanges++
    if (!e.stalled) this.clutchScores.push(QUALITY_SCORE[e.quality])
  }

  onLaunch(e: LaunchEvaluation) {
    this.session.launches++
    if (!e.stalled) this.clutchScores.push(QUALITY_SCORE[e.quality])
  }

  onHardBrake() {
    this.session.hardBrakes++
  }

  private scores(): Pick<DrivingSession, 'clutchControl' | 'rpmControl' | 'smoothness'> {
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
    const clutchControl = avg(this.clutchScores)
    const rpmControl = this.rpmTotal >= MIN_SAMPLE_S ? (this.rpmGood / this.rpmTotal) * 100 : null
    const motion = this.movingTime >= MIN_SAMPLE_S ? (this.smoothTime / this.movingTime) * 100 : null
    let smoothness: number | null = motion
    if (motion !== null && clutchControl !== null) smoothness = motion * 0.5 + clutchControl * 0.5
    else if (motion === null) smoothness = clutchControl
    if (smoothness !== null && this.session.hardBrakes > 0) smoothness = Math.max(0, smoothness - this.session.hardBrakes * 5)
    return {
      clutchControl: clutchControl === null ? null : Math.round(clutchControl),
      rpmControl: rpmControl === null ? null : Math.round(rpmControl),
      smoothness: smoothness === null ? null : Math.round(smoothness),
    }
  }
}

function newSession(mode: DrivingSession['mode'], exerciseId?: string): DrivingSession {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    startTime: Date.now(),
    duration: 0,
    mode,
    exerciseId,
    stalls: 0,
    gearChanges: 0,
    smoothChanges: 0,
    roughChanges: 0,
    hardBrakes: 0,
    launches: 0,
    maxSpeed: 0,
    maxRPM: 0,
    distanceMeters: 0,
    clutchControl: null,
    rpmControl: null,
    smoothness: null,
  }
}
