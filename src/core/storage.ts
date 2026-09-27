/** Acceso a localStorage tolerante a fallos (modo privado, cuota, JSON corrupto). */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sin almacenamiento disponible: la app sigue funcionando sin persistencia.
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignorar
  }
}

export const STORAGE_KEYS = {
  settings: 'amm.settings.v1',
  calibration: 'amm.calibration.v1',
  gamepadBindings: 'amm.bindings.gamepad.v1',
  keyboardBindings: 'amm.bindings.keyboard.v1',
  history: 'amm.history.v1',
  exercises: 'amm.exercises.v1',
} as const
