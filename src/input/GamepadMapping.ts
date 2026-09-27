import type { GamepadBinding, GamepadBindings, KeyboardBindings } from './types'

/**
 * Índices del "standard gamepad" (W3C), que es como Chrome/Edge exponen el DualSense.
 * Otros navegadores pueden usar un orden distinto: por eso las asignaciones
 * son configurables y se guardan en localStorage.
 */
export const STANDARD_BUTTONS = {
  cross: 0,
  circle: 1,
  square: 2,
  triangle: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  share: 8,
  options: 9,
  L3: 10,
  R3: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
  ps: 16,
  touchpad: 17,
} as const

const btn = (index: number): GamepadBinding => ({ kind: 'button', index })

export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  clutch: btn(STANDARD_BUTTONS.L2),
  accelerator: btn(STANDARD_BUTTONS.R2),
  brake: btn(STANDARD_BUTTONS.L1),
  gearUp: btn(STANDARD_BUTTONS.dpadUp),
  gearDown: btn(STANDARD_BUTTONS.dpadDown),
  gear5: btn(STANDARD_BUTTONS.triangle),
  reverse: btn(STANDARD_BUTTONS.circle),
  neutral: btn(STANDARD_BUTTONS.cross),
  // ✕ también arranca: con el motor en marcha arrancar no hace nada.
  start: btn(STANDARD_BUTTONS.cross),
  pause: btn(STANDARD_BUTTONS.options),
  restart: btn(STANDARD_BUTTONS.share),
}

export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBindings = {
  clutch: ['KeyA'],
  brake: ['KeyS'],
  accelerator: ['KeyD'],
  gear1: ['Numpad1', 'Digit1'],
  gear2: ['Numpad2', 'Digit2'],
  gear3: ['Numpad3', 'Digit3'],
  gear4: ['Numpad4', 'Digit4'],
  gear5: ['Numpad5', 'Digit5'],
  reverse: ['Numpad6', 'Digit6'],
  neutral: ['Numpad0', 'Digit0'],
  gearUp: ['ArrowUp'],
  gearDown: ['ArrowDown'],
  start: ['Space'],
  pause: ['Escape'],
  restart: ['KeyR'],
}

const BUTTON_NAMES: Record<number, string> = {
  0: '✕',
  1: '○',
  2: '□',
  3: '△',
  4: 'L1',
  5: 'R1',
  6: 'L2',
  7: 'R2',
  8: 'SHARE',
  9: 'OPTIONS',
  10: 'L3',
  11: 'R3',
  12: 'D-Pad ↑',
  13: 'D-Pad ↓',
  14: 'D-Pad ←',
  15: 'D-Pad →',
  16: 'PS',
  17: 'Touchpad',
}

export function describeGamepadBinding(b: GamepadBinding | undefined, standard = true): string {
  if (!b) return '—'
  if (b.kind === 'axis') return `Eje ${b.index}${b.direction < 0 ? ' (−)' : ' (+)'}`
  return (standard && BUTTON_NAMES[b.index]) || `Botón ${b.index}`
}

export function describeKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`
  const map: Record<string, string> = {
    Space: 'Espacio',
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift der.',
    ControlLeft: 'Ctrl',
    Enter: 'Enter',
  }
  return map[code] ?? code
}

/** Lee el valor bruto de una asignación en un Gamepad. */
export function readBinding(gp: Gamepad, b: GamepadBinding | undefined): number {
  if (!b) return 0
  if (b.kind === 'button') {
    const button = gp.buttons[b.index]
    if (!button) return 0
    // Algunos navegadores solo informan `pressed` en botones digitales.
    return button.value > 0 ? button.value : button.pressed ? 1 : 0
  }
  const v = gp.axes[b.index]
  return v === undefined ? 0 : v * b.direction
}

/** Identificación del DualSense (Sony, vendor 054c; productos 0ce6 / 0df2 Edge). */
export function isDualSense(id: string): boolean {
  const s = id.toLowerCase()
  return s.includes('dualsense') || /054c.*(0ce6|0df2)/.test(s) || (s.includes('wireless controller') && s.includes('054c'))
}
