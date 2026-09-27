import type { Calibration } from './types'

export type CalibrationStep = 'intro' | 'rest' | 'clutch' | 'accelerator' | 'done'

type Axis = 'clutch' | 'accelerator'
type Raw = Record<Axis, number>

const REST_SAMPLES = 30
/** Recorrido mínimo exigido para aceptar un gatillo como "pulsado a fondo". */
const MIN_TRAVEL = 0.3

/**
 * Asistente de calibración (sección 13):
 *  1. Reposo → valores mínimos.
 *  2. L2 a fondo → clutchMin / clutchMax.
 *  3. R2 a fondo → acceleratorMin / acceleratorMax.
 * Funciona también con ejes invertidos (el extremo puede ser menor que el reposo).
 */
export class CalibrationWizard {
  step: CalibrationStep = 'intro'
  private restSum: Raw = { clutch: 0, accelerator: 0 }
  private restCount = 0
  private extreme: Raw = { clutch: 0, accelerator: 0 }

  start() {
    this.step = 'rest'
    this.restSum = { clutch: 0, accelerator: 0 }
    this.restCount = 0
    this.extreme = { clutch: 0, accelerator: 0 }
  }

  rest(axis: Axis): number {
    return this.restCount ? this.restSum[axis] / this.restCount : 0
  }

  travel(axis: Axis): number {
    return Math.abs(this.extreme[axis] - this.rest(axis))
  }

  feed(raw: Raw) {
    if (this.step === 'rest') {
      this.restSum.clutch += raw.clutch
      this.restSum.accelerator += raw.accelerator
      this.restCount++
      this.extreme = { clutch: this.rest('clutch'), accelerator: this.rest('accelerator') }
    } else if (this.step === 'clutch' || this.step === 'accelerator') {
      const axis = this.step
      if (Math.abs(raw[axis] - this.rest(axis)) > this.travel(axis)) this.extreme[axis] = raw[axis]
    }
  }

  /** Progreso del paso actual (0–1). */
  progress(): number {
    if (this.step === 'rest') return Math.min(1, this.restCount / REST_SAMPLES)
    if (this.step === 'clutch' || this.step === 'accelerator') return Math.min(1, this.travel(this.step) / 0.9)
    return this.step === 'done' ? 1 : 0
  }

  canAdvance(): boolean {
    if (this.step === 'intro') return true
    if (this.step === 'rest') return this.restCount >= REST_SAMPLES
    if (this.step === 'clutch' || this.step === 'accelerator') return this.travel(this.step) >= MIN_TRAVEL
    return false
  }

  next() {
    if (!this.canAdvance()) return
    const order: CalibrationStep[] = ['intro', 'rest', 'clutch', 'accelerator', 'done']
    if (this.step === 'intro') return this.start()
    this.step = order[order.indexOf(this.step) + 1]
  }

  result(): Calibration {
    return {
      clutch: { min: this.rest('clutch'), max: this.extreme.clutch },
      accelerator: { min: this.rest('accelerator'), max: this.extreme.accelerator },
      calibrated: true,
    }
  }
}
