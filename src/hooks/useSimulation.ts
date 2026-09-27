import { useEffect, useSyncExternalStore } from 'react'
import { simulator } from '../core/instance'
import type { AppSnapshot } from '../core/Simulator'

/** Arranca el bucle de simulación mientras la app está montada. */
export function useSimulationLoop() {
  useEffect(() => {
    simulator.start()
    return () => simulator.stop()
  }, [])
}

/** Último snapshot publicado por el simulador (≈30 Hz, no 60 renders/s de física). */
export function useSimulation(): AppSnapshot {
  return useSyncExternalStore(simulator.subscribe, simulator.getSnapshot)
}

export { simulator }
