import { describe, expect, it } from 'vitest'
import { applyDeadzone, DEFAULT_INPUT_SETTINGS, normalize, smooth } from './calibration'
import { GamepadInput } from './GamepadInput'
import { STANDARD_BUTTONS } from './GamepadMapping'
import { EdgeTracker } from './InputDevice'
import { InputManager } from './InputManager'
import { KeyboardInput } from './KeyboardInput'

/** Mando falso con el mapeo estándar. */
function fakePad(values: Partial<Record<number, number>> = {}, axes: number[] = [0, 0, 0, 0]) {
  const buttons = Array.from({ length: 18 }, (_, i) => {
    const value = values[i] ?? 0
    return { pressed: value > 0.5, touched: value > 0, value }
  })
  return { id: 'DualSense Wireless Controller (Vendor: 054c Product: 0ce6)', index: 0, connected: true, mapping: 'standard', axes, buttons, timestamp: 0 } as unknown as Gamepad
}

const noSmoothing = { ...DEFAULT_INPUT_SETTINGS, clutch: { deadzone: 0.03, smoothing: 0 }, accelerator: { deadzone: 0.03, smoothing: 0 } }

function padWith(values: Partial<Record<number, number>>) {
  let pad = fakePad(values)
  const input = new GamepadInput(() => [pad])
  input.setSettings(noSmoothing)
  return { input, set: (v: Partial<Record<number, number>>) => (pad = fakePad(v)) }
}

describe('Input — gatillos del DualSense', () => {
  it('L2 0 → embrague 0, L2 1 → embrague 1', () => {
    const { input, set } = padWith({ [STANDARD_BUTTONS.L2]: 0 })
    input.update(1 / 60)
    expect(input.getState().clutch).toBe(0)
    set({ [STANDARD_BUTTONS.L2]: 1 })
    input.update(1 / 60)
    expect(input.getState().clutch).toBe(1)
  })

  it('R2 0 → acelerador 0, R2 1 → acelerador 1, R2 0.5 ≈ 50%', () => {
    const { input, set } = padWith({ [STANDARD_BUTTONS.R2]: 0 })
    input.update(1 / 60)
    expect(input.getState().accelerator).toBe(0)
    set({ [STANDARD_BUTTONS.R2]: 1 })
    input.update(1 / 60)
    expect(input.getState().accelerator).toBe(1)
    set({ [STANDARD_BUTTONS.R2]: 0.5 })
    input.update(1 / 60)
    expect(input.getState().accelerator).toBeCloseTo(0.485, 2)
  })

  it('usa la calibración guardada', () => {
    const { input, set } = padWith({ [STANDARD_BUTTONS.L2]: 0.9 })
    input.setCalibration({ clutch: { min: 0.1, max: 0.9 }, accelerator: { min: 0, max: 1 }, calibrated: true })
    input.update(1 / 60)
    expect(input.getState().clutch).toBe(1)
    set({ [STANDARD_BUTTONS.L2]: 0.1 })
    input.update(1 / 60)
    expect(input.getState().clutch).toBe(0)
  })

  it('D-pad ↑ produce gearUp una sola vez aunque se mantenga', () => {
    const { input, set } = padWith({ [STANDARD_BUTTONS.dpadUp]: 1 })
    input.update(1 / 60)
    expect(input.getState().gearUp).toBe(true)
    input.update(1 / 60)
    expect(input.getState().gearUp).toBe(false)
    set({})
    input.update(1 / 60)
    set({ [STANDARD_BUTTONS.dpadUp]: 1 })
    input.update(1 / 60)
    expect(input.getState().gearUp).toBe(true)
  })

  it('○ selecciona R y ✕ selecciona N + arranque', () => {
    const { input, set } = padWith({ [STANDARD_BUTTONS.circle]: 1 })
    input.update(1 / 60)
    expect(input.getState().selectedGear).toBe('R')
    set({ [STANDARD_BUTTONS.cross]: 1 })
    input.update(1 / 60)
    expect(input.getState().selectedGear).toBe('N')
    expect(input.getState().start).toBe(true)
  })

  it('L1 (digital) frena de forma progresiva', () => {
    const { input } = padWith({ [STANDARD_BUTTONS.L1]: 1 })
    input.update(0.1)
    const first = input.getState().brake
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(1)
    for (let i = 0; i < 20; i++) input.update(0.1)
    expect(input.getState().brake).toBe(1)
  })

  it('sin mando: estado vacío y no disponible', () => {
    const input = new GamepadInput(() => [])
    input.update(1 / 60)
    expect(input.isAvailable()).toBe(false)
    expect(input.getDiagnostics().connected).toBe(false)
    expect(input.getState().clutch).toBe(0)
  })
})

describe('Calibración', () => {
  it('normaliza entre min y max', () => {
    expect(normalize(0.2, { min: 0.2, max: 0.8 })).toBe(0)
    expect(normalize(0.5, { min: 0.2, max: 0.8 })).toBeCloseTo(0.5)
    expect(normalize(0.8, { min: 0.2, max: 0.8 })).toBe(1)
  })

  it('limita fuera de rango', () => {
    expect(normalize(-1, { min: 0, max: 1 })).toBe(0)
    expect(normalize(2, { min: 0, max: 1 })).toBe(1)
  })

  it('funciona con ejes -1…1', () => {
    expect(normalize(-1, { min: -1, max: 1 })).toBe(0)
    expect(normalize(0, { min: -1, max: 1 })).toBeCloseTo(0.5)
    expect(normalize(1, { min: -1, max: 1 })).toBe(1)
  })

  it('deadzone elimina lecturas pequeñas y conserva el 100%', () => {
    expect(applyDeadzone(0.02, 0.03)).toBe(0)
    expect(applyDeadzone(0.03, 0.03)).toBe(0)
    expect(applyDeadzone(1, 0.03)).toBe(1)
    expect(applyDeadzone(0.5, 0.03)).toBeGreaterThan(0.48)
  })

  it('smoothing 0 no suaviza y smoothing > 0 converge', () => {
    expect(smooth(0, 1, 0, 1 / 60)).toBe(1)
    const s = smooth(0, 1, 0.15, 1 / 60)
    expect(s).toBeGreaterThan(0.5)
    expect(s).toBeLessThan(1)
  })
})

describe('Teclado', () => {
  it('los pedales suben progresivamente y bajan al soltar', () => {
    const kb = new KeyboardInput()
    kb.press('KeyD')
    kb.update(0.25)
    const a = kb.getState().accelerator
    expect(a).toBeGreaterThan(0.2)
    expect(a).toBeLessThan(0.6)
    for (let i = 0; i < 10; i++) kb.update(0.25)
    expect(kb.getState().accelerator).toBe(1)
    kb.release('KeyD')
    kb.update(0.1)
    expect(kb.getState().accelerator).toBeLessThan(1)
    for (let i = 0; i < 20; i++) kb.update(0.1)
    expect(kb.getState().accelerator).toBe(0)
  })

  it('el resultado no depende de los FPS', () => {
    const a = new KeyboardInput()
    const b = new KeyboardInput()
    a.press('KeyA')
    b.press('KeyA')
    for (let i = 0; i < 30; i++) a.update(1 / 60)
    for (let i = 0; i < 72; i++) b.update(1 / 144)
    expect(a.getState().clutch).toBeCloseTo(b.getState().clutch, 5)
  })

  it('Numpad selecciona marchas directamente', () => {
    const kb = new KeyboardInput()
    kb.press('Numpad3')
    kb.update(1 / 60)
    expect(kb.getState().selectedGear).toBe(3)
    kb.update(1 / 60)
    expect(kb.getState().selectedGear).toBe(null)
    kb.press('Numpad6')
    kb.update(1 / 60)
    expect(kb.getState().selectedGear).toBe('R')
  })

  it('una pulsación muy rápida entre frames no se pierde', () => {
    const kb = new KeyboardInput()
    kb.press('Space')
    kb.release('Space')
    kb.update(1 / 60)
    expect(kb.getState().start).toBe(true)
  })
})

describe('InputManager', () => {
  it('elige el mando si está conectado y el teclado si no', () => {
    let pads: Gamepad[] = []
    const m = new InputManager(new GamepadInput(() => pads), new KeyboardInput())
    m.update(1 / 60)
    expect(m.getActiveKind()).toBe('keyboard')
    pads = [fakePad()]
    m.update(1 / 60)
    expect(m.getActiveKind()).toBe('gamepad')
    m.setPreference('keyboard')
    m.update(1 / 60)
    expect(m.getActiveKind()).toBe('keyboard')
  })

  it('Esc pausa aunque el dispositivo activo sea el mando', () => {
    const kb = new KeyboardInput()
    const m = new InputManager(new GamepadInput(() => [fakePad()]), kb)
    kb.press('Escape')
    m.update(1 / 60)
    expect(m.getActiveKind()).toBe('gamepad')
    expect(m.getState().pause).toBe(true)
  })
})

describe('EdgeTracker', () => {
  it('distingue pressed / wasPressed / wasReleased', () => {
    const e = new EdgeTracker<string>()
    e.update(['x'])
    expect(e.wasPressed('x')).toBe(true)
    expect(e.isPressed('x')).toBe(true)
    e.update(['x'])
    expect(e.wasPressed('x')).toBe(false)
    expect(e.isPressed('x')).toBe(true)
    e.update([])
    expect(e.wasReleased('x')).toBe(true)
    expect(e.isPressed('x')).toBe(false)
  })
})
