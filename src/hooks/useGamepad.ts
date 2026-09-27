import { useSimulation } from './useSimulation'

/** Estado del mando para indicadores y diagnóstico. */
export function useGamepad() {
  const snap = useSimulation()
  return {
    diagnostics: snap.gamepad,
    connected: snap.gamepad.connected,
    active: snap.activeDevice === 'gamepad',
    preference: snap.settings.device,
  }
}
