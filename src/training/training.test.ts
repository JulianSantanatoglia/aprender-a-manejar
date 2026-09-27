import { describe, expect, it } from 'vitest'
import { GamepadInput } from '../input/GamepadInput'
import { InputManager } from '../input/InputManager'
import { KeyboardInput } from '../input/KeyboardInput'
import { SimulationEngine } from '../simulation/engine'
import type { DriverControls, Gear, SimulationEvent } from '../simulation/types'
import { analyzeDriving } from './assistant'
import { ExerciseTracker, getExercise } from './exercises'
import { LaunchAnalyzer } from './LaunchAnalyzer'
import { SessionTracker } from './SessionTracker'
import { ShiftAnalyzer } from './ShiftAnalyzer'
import type { LaunchEvaluation, ShiftEvaluation } from './types'

const FRAME = 1 / 60

/** Mini-runtime equivalente al del Simulator, sin DOM ni requestAnimationFrame. */
class Harness {
  sim = new SimulationEngine()
  shifts = new ShiftAnalyzer()
  launches = new LaunchAnalyzer()
  session = new SessionTracker()
  shiftEvals: ShiftEvaluation[] = []
  launchEvals: LaunchEvaluation[] = []
  events: SimulationEvent[] = []

  step(controls: DriverControls, cmd: { selectGear?: Gear; start?: boolean } = {}) {
    this.sim.update(FRAME, controls, { gearUp: false, gearDown: false, selectGear: cmd.selectGear ?? null, start: !!cmd.start })
    const t = this.sim.getTelemetry()
    const time = this.sim.time
    for (const e of this.sim.drainEvents()) {
      this.events.push(e)
      if (e.type === 'gearChange') {
        this.session.onGearChange()
        this.shifts.onGearChange(e.event, t, time)
      }
      if (e.type === 'stall') {
        this.session.onStall()
        const l = this.launches.onStall()
        if (l) this.launchEvals.push(l)
        const s = this.shifts.onStall(t)
        if (s) this.shiftEvals.push(s)
      }
    }
    const s = this.shifts.update(t, time, 6500)
    if (s) {
      this.shiftEvals.push(s)
      this.session.onShift(s)
    }
    const l = this.launches.update(t, time, FRAME)
    if (l) {
      this.launchEvals.push(l)
      this.session.onLaunch(l)
    }
    this.session.update(t, FRAME, 0)
  }

  run(seconds: number, controls: DriverControls | ((t: number) => DriverControls), cmd: { selectGear?: Gear; start?: boolean } = {}) {
    const n = Math.round(seconds / FRAME)
    for (let i = 0; i < n; i++) this.step(typeof controls === 'function' ? controls(i * FRAME) : controls, i === 0 ? cmd : {})
  }
}

const pressed = { clutch: 1, accelerator: 0, brake: 0 }

/**
 * Salida como la enseña el asistente: llegar rápido al punto de fricción,
 * soltar despacio dentro de él y terminar de soltar cuando el coche ya se mueve.
 */
const goodLaunch = (accelerator: number) => (t: number) => ({
  clutch: t < 0.4 ? 1 - (t / 0.4) * 0.28 : t < 2.6 ? 0.72 - ((t - 0.4) / 2.2) * 0.3 : Math.max(0, 0.42 - (t - 2.6) / 0.6 * 0.42),
  accelerator,
  brake: 0,
})

describe('Criterio de éxito (sección 86)', () => {
  it('arrancar → 1ª → salir → 2ª → 3ª → frenar → reducir → parar → N sin inconsistencias', () => {
    const h = new Harness()
    h.run(0.5, pressed, { selectGear: 1 })
    h.run(4, goodLaunch(0.2))
    expect(h.launchEvals).toHaveLength(1)
    expect(['smooth', 'acceptable']).toContain(h.launchEvals[0].quality)

    h.run(2.5, { clutch: 0, accelerator: 0.5, brake: 0 })
    for (const g of [2, 3] as const) {
      h.run(0.3, pressed)
      h.run(0.2, pressed, { selectGear: g })
      h.run(2, (t) => ({ clutch: Math.max(0, 1 - t / 1.5), accelerator: 0.15, brake: 0 }))
      h.run(2.5, { clutch: 0, accelerator: 0.5, brake: 0 })
    }
    expect(h.shiftEvals.map((e) => `${e.from}>${e.to}`)).toEqual(['1>2', '2>3'])
    h.shiftEvals.forEach((e) => expect(['smooth', 'acceptable']).toContain(e.quality))

    h.run(2, { clutch: 0, accelerator: 0, brake: 0.5 })
    h.run(0.3, pressed)
    h.run(0.2, { ...pressed, accelerator: 0.3 }, { selectGear: 2 })
    h.run(2, (t) => ({ clutch: Math.max(0, 1 - t / 1.5), accelerator: 0, brake: 0 }))
    h.run(6, (t) => ({ clutch: t > 0.8 ? 1 : 0, accelerator: 0, brake: 0.7 }))
    h.run(0.3, pressed, { selectGear: 'N' })

    const t = h.sim.getTelemetry()
    expect(t.speedKmh).toBe(0)
    expect(t.gear).toBe('N')
    expect(t.engineRunning).toBe(true)
    expect(h.events.filter((e) => e.type === 'stall')).toHaveLength(0)

    const s = h.session.get()
    expect(s.stalls).toBe(0)
    expect(s.gearChanges).toBe(5)
    expect(s.smoothChanges).toBeGreaterThanOrEqual(2)
    expect(s.clutchControl).not.toBeNull()
    expect(s.rpmControl).not.toBeNull()
  })

  it('funciona igual alimentado desde el teclado a través del InputManager', () => {
    const kb = new KeyboardInput()
    const input = new InputManager(new GamepadInput(() => []), kb)
    const sim = new SimulationEngine()
    const tick = () => {
      input.update(FRAME)
      const s = input.getState()
      sim.update(FRAME, s, { gearUp: s.gearUp, gearDown: s.gearDown, selectGear: s.selectedGear, start: s.start })
    }
    kb.press('KeyA')
    for (let i = 0; i < 60; i++) tick()
    kb.press('Numpad1')
    tick()
    kb.release('Numpad1')
    expect(sim.getTelemetry().gear).toBe(1)
    // El embrague de teclado se suelta despacio; el usuario da gas mirando el tacómetro.
    kb.release('KeyA')
    for (let i = 0; i < 300; i++) {
      if (sim.getTelemetry().rpm < 1800) kb.press('KeyD')
      else kb.release('KeyD')
      tick()
    }
    expect(sim.getTelemetry().engineRunning).toBe(true)
    expect(sim.getTelemetry().speedKmh).toBeGreaterThan(3)
  })
})

describe('Evaluaciones', () => {
  it('soltar el embrague de golpe en la salida: calado y mensaje de embrague rápido', () => {
    const h = new Harness()
    h.run(0.5, pressed, { selectGear: 1 })
    h.run(0.1, { clutch: 0.8, accelerator: 0, brake: 0 })
    h.run(1, { clutch: 0, accelerator: 0, brake: 0 })
    expect(h.session.get().stalls).toBe(1)
    expect(h.launchEvals).toHaveLength(1)
    expect(h.launchEvals[0].stalled).toBe(true)
    expect(h.launchEvals[0].message).toBe('Has soltado demasiado rápido el embrague.')
  })

  it('salida con mucho acelerador: se permite pero se avisa', () => {
    const h = new Harness()
    h.run(0.5, pressed, { selectGear: 1 })
    h.run(4, (t) => ({ clutch: Math.max(0, 1 - t / 3), accelerator: 0.9, brake: 0 }))
    expect(h.launchEvals[0].stalled).toBe(false)
    expect(h.launchEvals[0].message).toBe('Salida brusca. Intenta utilizar menos acelerador.')
  })

  it('cambio sin embrague: se marca y se penaliza', () => {
    const h = new Harness()
    h.sim.reset({ gear: 2, speedKmh: 35 })
    h.run(0.3, { clutch: 0, accelerator: 0.3, brake: 0 })
    h.run(1, { clutch: 0, accelerator: 0.3, brake: 0 }, { selectGear: 3 })
    expect(h.shiftEvals).toHaveLength(1)
    expect(h.shiftEvals[0].noClutch).toBe(true)
    expect(['rough', 'bad']).toContain(h.shiftEvals[0].quality)
    expect(h.sim.getTelemetry().gear).toBe(3)
  })

  it('reducción soltando el embrague de golpe: aviso de aumento brusco de RPM', () => {
    const h = new Harness()
    h.sim.reset({ gear: 3, speedKmh: 50 })
    h.run(0.4, pressed)
    h.run(0.1, pressed, { selectGear: 2 })
    h.run(1, { clutch: 0, accelerator: 0, brake: 0 })
    expect(h.shiftEvals[0].kind).toBe('downshift')
    expect(['rough', 'bad']).toContain(h.shiftEvals[0].quality)
    expect(h.shiftEvals[0].message).toContain('aumento brusco de RPM')
  })
})

describe('Asistente', () => {
  it('guía la salida paso a paso', () => {
    const sim = new SimulationEngine()
    const cfg = sim.getConfig()
    const texts = () => analyzeDriving(sim.getTelemetry(), cfg, { startLabel: '✕' }).map((i) => i.text)
    sim.update(FRAME, pressed)
    expect(texts()).toContain('Selecciona primera')
    sim.update(FRAME, pressed, { gearUp: false, gearDown: false, selectGear: 1, start: false })
    expect(texts()).toContain('Primera seleccionada')
    expect(texts()).toContain('Acelera ligeramente (15–25 %)')
  })

  it('avisa del calado', () => {
    const sim = new SimulationEngine()
    sim.reset({ gear: 3, speedKmh: 5 })
    sim.update(0.2, { clutch: 0, accelerator: 0, brake: 0 })
    const items = analyzeDriving(sim.getTelemetry(), sim.getConfig(), { startLabel: '✕' })
    expect(items[0].text).toBe('⚠ MOTOR CALADO')
  })
})

describe('Ejercicios', () => {
  it('Ejercicio 1 se supera al llegar a 20 km/h sin calar', () => {
    const tracker = new ExerciseTracker(getExercise('launch')!)
    const h = new Harness()
    h.run(0.5, pressed, { selectGear: 1 })
    h.run(4, goodLaunch(0.25))
    for (let i = 0; i < 300 && tracker.get().state === 'running'; i++) {
      h.step({ clutch: 0, accelerator: 0.5, brake: 0 })
      tracker.onFrame(h.sim.getTelemetry(), FRAME)
    }
    expect(tracker.get().state).toBe('success')
  })

  it('Ejercicio 5 falla si se cala al frenar sin pisar el embrague', () => {
    const def = getExercise('brake-stop')!
    const tracker = new ExerciseTracker(def)
    const h = new Harness()
    h.sim.reset(def.initial)
    for (let i = 0; i < 600 && tracker.get().state === 'running'; i++) {
      h.step({ clutch: 0, accelerator: 0, brake: 1 })
      if (h.events.some((e) => e.type === 'stall')) tracker.onStall(h.sim.getTelemetry())
      tracker.onFrame(h.sim.getTelemetry(), FRAME)
    }
    expect(tracker.get().state).toBe('fail')
  })
})
