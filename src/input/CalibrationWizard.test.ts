import { describe, expect, it } from 'vitest'
import { normalize } from './calibration'
import { CalibrationWizard } from './CalibrationWizard'

function calibrate(rest: { clutch: number; accelerator: number }, clutchMax: number, accelMax: number) {
  const w = new CalibrationWizard()
  w.next()
  for (let i = 0; i < 40; i++) w.feed(rest)
  w.next()
  for (let v = 0; v <= 1; v += 0.1) w.feed({ clutch: rest.clutch + (clutchMax - rest.clutch) * v, accelerator: rest.accelerator })
  w.next()
  for (let v = 0; v <= 1; v += 0.1) w.feed({ clutch: rest.clutch, accelerator: rest.accelerator + (accelMax - rest.accelerator) * v })
  w.next()
  return w
}

describe('CalibrationWizard', () => {
  it('guarda min/max de L2 y R2', () => {
    const w = calibrate({ clutch: 0.02, accelerator: 0.01 }, 0.97, 0.99)
    expect(w.step).toBe('done')
    const c = w.result()
    expect(c.clutch.min).toBeCloseTo(0.02)
    expect(c.clutch.max).toBeCloseTo(0.97, 1)
    expect(c.accelerator.max).toBeCloseTo(0.99, 1)
    expect(normalize(0.02, c.clutch)).toBe(0)
    expect(normalize(0.97, c.clutch)).toBeCloseTo(1, 1)
  })

  it('funciona con un eje invertido (1 en reposo, -1 pulsado)', () => {
    const w = calibrate({ clutch: 1, accelerator: 1 }, -1, -1)
    const c = w.result()
    expect(normalize(1, c.clutch)).toBe(0)
    expect(normalize(-1, c.clutch)).toBe(1)
    expect(normalize(0, c.clutch)).toBeCloseTo(0.5)
  })

  it('no avanza si el gatillo no se ha pulsado lo suficiente', () => {
    const w = new CalibrationWizard()
    w.next()
    for (let i = 0; i < 40; i++) w.feed({ clutch: 0, accelerator: 0 })
    w.next()
    w.feed({ clutch: 0.1, accelerator: 0 })
    expect(w.canAdvance()).toBe(false)
    w.next()
    expect(w.step).toBe('clutch')
  })
})
