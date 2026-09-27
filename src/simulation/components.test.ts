import { describe, expect, it } from 'vitest'
import { clutchCapacity, clutchEngagementFromPedal, isInFrictionZone } from './clutch'
import { CLUTCH_BITE_POINT, CLUTCH_MAX_TORQUE, IDLE_RPM } from './constants'
import { fullLoadTorque } from './enginePhysics'
import { nextGearDown, nextGearUp, requestShift, totalRatio } from './gearbox'
import { drivetrainRpm, speedForRpm } from './physics'
import { SimulationEngine } from './engine'

describe('Embrague', () => {
  it('pedal pisado → no transmite', () => {
    expect(clutchEngagementFromPedal(1, CLUTCH_BITE_POINT)).toBe(0)
    expect(clutchCapacity(clutchEngagementFromPedal(1, CLUTCH_BITE_POINT))).toBe(0)
  })

  it('pedal suelto → transmite todo', () => {
    expect(clutchEngagementFromPedal(0, CLUTCH_BITE_POINT)).toBe(1)
    expect(clutchCapacity(1)).toBe(CLUTCH_MAX_TORQUE)
  })

  it('en el punto de fricción empieza a transmitir poco par', () => {
    const e = clutchEngagementFromPedal(CLUTCH_BITE_POINT, CLUTCH_BITE_POINT)
    expect(e).toBeGreaterThan(0)
    expect(e).toBeLessThan(0.5)
    const cap = clutchCapacity(e)
    expect(cap).toBeGreaterThan(5)
    expect(cap).toBeLessThan(fullLoadTorque(2000))
    expect(isInFrictionZone(CLUTCH_BITE_POINT, CLUTCH_BITE_POINT)).toBe(true)
    expect(isInFrictionZone(1, CLUTCH_BITE_POINT)).toBe(false)
  })

  it('el acoplamiento es monótono al soltar el pedal', () => {
    let prev = -1
    for (let p = 1; p >= 0; p -= 0.01) {
      const e = clutchEngagementFromPedal(p, CLUTCH_BITE_POINT)
      expect(e).toBeGreaterThanOrEqual(prev)
      prev = e
    }
  })
})

describe('Caja de cambios', () => {
  const ctx = { speedKmh: 0, clutchPedal: 1, clutchEngagement: 0 }

  it('sube secuencialmente N → 1 → 2 → 3 → 4 → 5', () => {
    const seq = ['N', 1, 2, 3, 4, 5]
    for (let i = 0; i < seq.length - 1; i++) {
      expect(nextGearUp(seq[i] as never)).toBe(seq[i + 1])
    }
    expect(nextGearUp(5)).toBe(null)
  })

  it('baja secuencialmente 5 → 4 → 3 → 2 → 1 → N', () => {
    expect(nextGearDown(5)).toBe(4)
    expect(nextGearDown(2)).toBe(1)
    expect(nextGearDown(1)).toBe('N')
  })

  it('N → R solo parado y con embrague pisado', () => {
    expect(requestShift('N', 'R', ctx).ok).toBe(true)
    expect(requestShift('N', 'R', { ...ctx, speedKmh: 20 }).ok).toBe(false)
    expect(requestShift('N', 'R', { ...ctx, clutchPedal: 0.3 }).ok).toBe(false)
  })

  it('cambiar sin embrague se permite pero se marca', () => {
    const r = requestShift(2, 3, { speedKmh: 40, clutchPedal: 0, clutchEngagement: 1 })
    expect(r.ok).toBe(true)
    expect(r.ok && r.noClutch).toBe(true)
  })

  it('pasar a N nunca se considera cambio sin embrague', () => {
    const r = requestShift(3, 'N', { speedKmh: 40, clutchPedal: 0, clutchEngagement: 1 })
    expect(r.ok && r.noClutch).toBe(false)
  })

  it('la marcha atrás tiene relación negativa y N no transmite', () => {
    expect(totalRatio('R')).toBeLessThan(0)
    expect(totalRatio('N')).toBe(0)
  })

  it('RPM y velocidad son coherentes en ambos sentidos', () => {
    const v = speedForRpm(3000, 2)
    expect(drivetrainRpm(v, 2)).toBeCloseTo(3000, 3)
  })
})

describe('Calado', () => {
  it('RPM bajas + embrague acoplado + carga = calado', () => {
    const sim = new SimulationEngine()
    sim.reset({ gear: 3, speedKmh: 8 }) // 3ª a 8 km/h ≈ 340 RPM con el embrague acoplado
    sim.update(0.05, { clutch: 0, accelerator: 0, brake: 0 })
    const events = sim.drainEvents()
    expect(events.some((e) => e.type === 'stall')).toBe(true)
    expect(sim.getTelemetry().rpm).toBe(0)
  })

  it('con embrague pisado no se cala aunque el coche esté parado en marcha', () => {
    const sim = new SimulationEngine()
    for (let i = 0; i < 60; i++) sim.update(1 / 60, { clutch: 1, accelerator: 0, brake: 1 }, { gearUp: i === 0, gearDown: false, selectGear: null, start: false })
    expect(sim.getTelemetry().gear).toBe(1)
    expect(sim.getTelemetry().engineRunning).toBe(true)
    expect(sim.getTelemetry().rpm).toBeGreaterThan(IDLE_RPM - 50)
  })
})
