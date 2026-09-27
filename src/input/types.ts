import type { Gear } from '../simulation/types'

/** Estado común que producen todos los dispositivos (sección 5). */
export interface InputState {
  /** Pedal de embrague: 1 = pisado a fondo, 0 = suelto. */
  clutch: number
  accelerator: number
  brake: number

  /** Flancos (true solo en el frame en que se pulsa). */
  gearUp: boolean
  gearDown: boolean
  selectedGear: Gear | null

  start: boolean
  pause: boolean
  restart: boolean
}

export const EMPTY_INPUT: InputState = {
  clutch: 0,
  accelerator: 0,
  brake: 0,
  gearUp: false,
  gearDown: false,
  selectedGear: null,
  start: false,
  pause: false,
  restart: false,
}

export type DeviceKind = 'gamepad' | 'keyboard'
export type DevicePreference = 'auto' | DeviceKind

export type AnalogAction = 'clutch' | 'accelerator' | 'brake'
export type DigitalAction =
  | 'gearUp'
  | 'gearDown'
  | 'neutral'
  | 'reverse'
  | 'gear1'
  | 'gear2'
  | 'gear3'
  | 'gear4'
  | 'gear5'
  | 'start'
  | 'pause'
  | 'restart'
export type ActionId = AnalogAction | DigitalAction

export const ACTION_LABELS: Record<ActionId, string> = {
  clutch: 'Embrague',
  accelerator: 'Acelerador',
  brake: 'Freno',
  gearUp: 'Subir marcha',
  gearDown: 'Bajar marcha',
  neutral: 'Neutral',
  reverse: 'Marcha atrás',
  gear1: '1ª',
  gear2: '2ª',
  gear3: '3ª',
  gear4: '4ª',
  gear5: '5ª',
  start: 'Arranque',
  pause: 'Pausa',
  restart: 'Reinicio',
}

/** Qué marcha selecciona cada acción directa. */
export const DIRECT_GEAR_ACTIONS: ReadonlyArray<readonly [DigitalAction, Gear]> = [
  ['neutral', 'N'],
  ['reverse', 'R'],
  ['gear1', 1],
  ['gear2', 2],
  ['gear3', 3],
  ['gear4', 4],
  ['gear5', 5],
]

export type GamepadBinding =
  | { kind: 'button'; index: number }
  /** Eje; `direction` = -1 invierte el sentido. */
  | { kind: 'axis'; index: number; direction: 1 | -1 }

export type GamepadBindings = Partial<Record<ActionId, GamepadBinding>>
/** Cada acción puede tener varias teclas (`KeyboardEvent.code`). */
export type KeyboardBindings = Partial<Record<ActionId, string[]>>

export interface AxisCalibration {
  min: number
  max: number
}

export interface Calibration {
  clutch: AxisCalibration
  accelerator: AxisCalibration
  calibrated: boolean
}

export interface AxisProcessing {
  /** 0–0.1 */
  deadzone: number
  /** 0 = sin suavizado, 1 = máximo. */
  smoothing: number
}

export interface InputSettings {
  clutch: AxisProcessing
  accelerator: AxisProcessing
  /** Velocidad (fracción/s) con la que sube un pedal de teclado mientras la tecla está pulsada. */
  keyboardPressRate: number
  /** Velocidad con la que baja un pedal de teclado al soltar la tecla. */
  keyboardReleaseRate: number
  /** El embrague de teclado baja más despacio para poder encontrar la fricción. */
  keyboardClutchReleaseRate: number
  /** Rampa del freno digital (L1), fracción/s. */
  digitalBrakeRate: number
}

/** Información de diagnóstico del mando (pantalla de configuración). */
export interface GamepadDiagnostics {
  connected: boolean
  id: string
  mapping: string
  isDualSense: boolean
  axes: number[]
  buttons: { pressed: boolean; value: number }[]
  raw: Record<AnalogAction, number>
  processed: Record<AnalogAction, number>
}
