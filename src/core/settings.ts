import { defaultCalibration, DEFAULT_INPUT_SETTINGS } from '../input/calibration'
import { DEFAULT_GAMEPAD_BINDINGS, DEFAULT_KEYBOARD_BINDINGS } from '../input/GamepadMapping'
import type { Calibration, DevicePreference, GamepadBindings, InputSettings, KeyboardBindings } from '../input/types'
import { DEFAULT_VEHICLE_CONFIG } from '../simulation/constants'
import type { VehicleConfig } from '../simulation/types'
import { loadJSON, saveJSON, STORAGE_KEYS } from './storage'

export interface AppSettings {
  device: DevicePreference
  input: InputSettings
  vehicle: VehicleConfig
  audio: { enabled: boolean; volume: number }
  assistant: boolean
  /** Vista lateral de la ruta con el coche. */
  showRoad: boolean
  debug: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  device: 'auto',
  input: DEFAULT_INPUT_SETTINGS,
  vehicle: DEFAULT_VEHICLE_CONFIG,
  audio: { enabled: true, volume: 0.6 },
  assistant: true,
  showRoad: true,
  debug: false,
}

/** Mezcla lo guardado con los valores por defecto (tolera versiones antiguas). */
export function loadSettings(): AppSettings {
  const saved = loadJSON<Partial<AppSettings>>(STORAGE_KEYS.settings, {})
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    input: {
      ...DEFAULT_INPUT_SETTINGS,
      ...saved.input,
      clutch: { ...DEFAULT_INPUT_SETTINGS.clutch, ...saved.input?.clutch },
      accelerator: { ...DEFAULT_INPUT_SETTINGS.accelerator, ...saved.input?.accelerator },
    },
    vehicle: { ...DEFAULT_VEHICLE_CONFIG, ...saved.vehicle },
    audio: { ...DEFAULT_SETTINGS.audio, ...saved.audio },
  }
}

export function saveSettings(s: AppSettings) {
  saveJSON(STORAGE_KEYS.settings, s)
}

export function loadCalibration(): Calibration {
  const c = loadJSON<Calibration | null>(STORAGE_KEYS.calibration, null)
  return c && c.clutch && c.accelerator ? c : defaultCalibration()
}

export function saveCalibration(c: Calibration) {
  saveJSON(STORAGE_KEYS.calibration, c)
}

export function loadGamepadBindings(): GamepadBindings {
  return { ...DEFAULT_GAMEPAD_BINDINGS, ...loadJSON<GamepadBindings>(STORAGE_KEYS.gamepadBindings, {}) }
}

export function saveGamepadBindings(b: GamepadBindings) {
  saveJSON(STORAGE_KEYS.gamepadBindings, b)
}

export function loadKeyboardBindings(): KeyboardBindings {
  return { ...DEFAULT_KEYBOARD_BINDINGS, ...loadJSON<KeyboardBindings>(STORAGE_KEYS.keyboardBindings, {}) }
}

export function saveKeyboardBindings(b: KeyboardBindings) {
  saveJSON(STORAGE_KEYS.keyboardBindings, b)
}
