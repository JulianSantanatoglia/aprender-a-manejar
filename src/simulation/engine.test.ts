import { describe, expect, it } from 'vitest'
import { SimulationEngine, NO_COMMANDS, type DriverCommands } from './engine'
import type { DriverControls, Gear } from './types'

const FRAME = 1 / 60

function run(
  sim: SimulationEngine,
  seconds: number,
  controls: DriverControls | ((t: number) => DriverControls),
  commands: Partial<DriverCommands> = {},
) {
  const frames = Math.round(seconds / FRAME)
  let maxJolt = 0
  let minRpm = Infinity
  for (let i = 0; i < frames; i++) {
    const c = typeof controls === 'function' ? controls(i * FRAME) : controls
    sim.update(FRAME, c, i === 0 ? { ...NO_COMMANDS, ...commands } : NO_COMMANDS)
    const t = sim.getTelemetry()
    maxJolt = Math.max(maxJolt, t.jolt)
    if (t.engineRunning) minRpm = Math.min(minRpm, t.rpm)
  }
  return { maxJolt, minRpm }
}

const shift = (to: Gear): Partial<DriverCommands> => ({ selectGear: to })
const stalls = (sim: SimulationEngine) => sim.drainEvents().filter((e) => e.type === 'stall').length

describe('SimulationEngine', () => {
  it('mantiene el ralentí en neutral', () => {
    const sim = new SimulationEngine()
    run(sim, 3, { clutch: 0, accelerator: 0, brake: 0 })
    const t = sim.getTelemetry()
    expect(t.engineRunning).toBe(true)
    expect(t.rpm).toBeGreaterThan(750)
    expect(t.rpm).toBeLessThan(850)
    expect(t.speedKmh).toBe(0)
  })

  it('el acelerador sube RPM en neutral sin mover el coche', () => {
    const sim = new SimulationEngine()
    run(sim, 3, { clutch: 0, accelerator: 0.2, brake: 0 })
    const t = sim.getTelemetry()
    expect(t.rpm).toBeGreaterThan(2000)
    expect(t.rpm).toBeLessThan(6500)
    expect(t.speedKmh).toBe(0)
  })

  it('el limitador impide superar la línea roja', () => {
    const sim = new SimulationEngine()
    run(sim, 4, { clutch: 0, accelerator: 1, brake: 0 })
    expect(sim.getTelemetry().rpm).toBeLessThan(6700)
  })

  it('salida progresiva: embrague lento + ~20% acelerador no cala', () => {
    const sim = new SimulationEngine()
    run(sim, 0.5, { clutch: 1, accelerator: 0, brake: 0 }, shift(1))
    const { minRpm } = run(sim, 3.5, (t) => ({ clutch: Math.max(0, 1 - t / 3), accelerator: 0.2, brake: 0 }))
    const t = sim.getTelemetry()
    expect(stalls(sim)).toBe(0)
    expect(t.engineRunning).toBe(true)
    expect(t.speedKmh).toBeGreaterThan(5)
    expect(minRpm).toBeGreaterThan(600)
  })

  it('soltar el embrague de golpe sin gas cala el motor', () => {
    const sim = new SimulationEngine()
    run(sim, 0.5, { clutch: 1, accelerator: 0, brake: 0 }, shift(1))
    run(sim, 1, { clutch: 0, accelerator: 0, brake: 0 })
    const t = sim.getTelemetry()
    expect(stalls(sim)).toBe(1)
    expect(t.engineRunning).toBe(false)
    expect(t.stalled).toBe(true)
    expect(t.rpm).toBe(0)
  })

  it('arranca tras calar solo con embrague pisado o en N', () => {
    const sim = new SimulationEngine()
    run(sim, 0.5, { clutch: 1, accelerator: 0, brake: 0 }, shift(1))
    run(sim, 1, { clutch: 0, accelerator: 0, brake: 0 })
    expect(sim.getTelemetry().stalled).toBe(true)
    sim.drainEvents()
    run(sim, 0.2, { clutch: 0, accelerator: 0, brake: 0 }, { start: true })
    expect(sim.getTelemetry().engineRunning).toBe(false)
    expect(sim.drainEvents().some((e) => e.type === 'startFailed')).toBe(true)
    run(sim, 0.2, { clutch: 1, accelerator: 0, brake: 0 }, { start: true })
    expect(sim.getTelemetry().engineRunning).toBe(true)
    expect(sim.getTelemetry().rpm).toBeGreaterThan(700)
  })

  it('frenar hasta parar sin pisar el embrague cala; pisándolo no', () => {
    const a = new SimulationEngine()
    a.reset({ gear: 2, speedKmh: 30 })
    run(a, 6, { clutch: 0, accelerator: 0, brake: 1 })
    expect(stalls(a)).toBe(1)

    const b = new SimulationEngine()
    b.reset({ gear: 2, speedKmh: 30 })
    run(b, 6, (t) => ({ clutch: t > 0.4 ? 1 : 0, accelerator: 0, brake: 1 }))
    expect(stalls(b)).toBe(0)
    expect(b.getTelemetry().speedKmh).toBe(0)
  })

  it('secuencia completa: 1ª → 2ª → 3ª → frenar → reducir → parar → N', () => {
    const sim = new SimulationEngine()
    const idle = { clutch: 1, accelerator: 0, brake: 0 }
    run(sim, 0.3, idle, shift(1))
    run(sim, 3.5, (t) => ({ clutch: Math.max(0, 1 - t / 3), accelerator: 0.25, brake: 0 }))
    run(sim, 3, { clutch: 0, accelerator: 0.6, brake: 0 })
    expect(sim.getTelemetry().speedKmh).toBeGreaterThan(20)

    for (const g of [2, 3] as const) {
      run(sim, 0.4, { clutch: 1, accelerator: 0, brake: 0 })
      run(sim, 0.1, { clutch: 1, accelerator: 0, brake: 0 }, shift(g))
      const { maxJolt } = run(sim, 2, (t) => ({ clutch: Math.max(0, 1 - t / 1.5), accelerator: 0.2, brake: 0 }))
      expect(maxJolt).toBeLessThan(3)
      expect(sim.getTelemetry().gear).toBe(g)
      run(sim, 3, { clutch: 0, accelerator: 0.6, brake: 0 })
    }
    expect(sim.getTelemetry().speedKmh).toBeGreaterThan(40)

    run(sim, 1.5, { clutch: 0, accelerator: 0, brake: 0.6 })
    run(sim, 0.3, { clutch: 1, accelerator: 0, brake: 0.3 }, shift(2))
    run(sim, 1, (t) => ({ clutch: Math.max(0, 1 - t), accelerator: 0, brake: 0 }))
    run(sim, 6, (t) => ({ clutch: t > 1 ? 1 : 0, accelerator: 0, brake: 0.8 }))
    run(sim, 0.2, { clutch: 1, accelerator: 0, brake: 0.8 }, shift('N'))

    const t = sim.getTelemetry()
    expect(stalls(sim)).toBe(0)
    expect(t.speedKmh).toBe(0)
    expect(t.gear).toBe('N')
    expect(t.engineRunning).toBe(true)
  })

  it('soltar de golpe tras un cambio produce más brusquedad que soltar progresivamente', () => {
    const make = () => {
      const s = new SimulationEngine()
      s.reset({ gear: 3, speedKmh: 45 })
      run(s, 0.3, { clutch: 1, accelerator: 0, brake: 0 }, shift(2))
      return s
    }
    const soft = run(make(), 2.5, (t) => ({ clutch: Math.max(0, 1 - t / 2), accelerator: 0, brake: 0 }))
    const hard = run(make(), 1.5, { clutch: 0, accelerator: 0, brake: 0 })
    expect(hard.maxJolt).toBeGreaterThan(soft.maxJolt * 1.5)
  })

  it('marcha atrás mueve el coche hacia atrás', () => {
    const sim = new SimulationEngine()
    run(sim, 0.2, { clutch: 1, accelerator: 0, brake: 0 }, shift('R'))
    expect(sim.getTelemetry().gear).toBe('R')
    run(sim, 4, (t) => ({ clutch: Math.max(0, 1 - t / 3), accelerator: 0.2, brake: 0 }))
    expect(sim.getTelemetry().speedKmh).toBeLessThan(-3)
    expect(sim.getTelemetry().positionMeters).toBeLessThan(0)
    expect(sim.getTelemetry().distanceMeters).toBeCloseTo(-sim.getTelemetry().positionMeters, 5)
  })

  it('el coche parado permanece en 0 exacto', () => {
    const sim = new SimulationEngine()
    run(sim, 2, { clutch: 0, accelerator: 0, brake: 0 })
    expect(sim.getTelemetry().speedKmh).toBe(0)
  })
})
