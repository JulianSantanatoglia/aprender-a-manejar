import { useEffect } from 'react'
import { simulator } from '../core/instance'

/**
 * Atajos globales de la interfaz (los controles de conducción los gestiona KeyboardInput):
 * - F2: modo debug.
 * - Cualquier tecla o clic desbloquea el audio (requisito del navegador).
 */
export function useKeyboard() {
  useEffect(() => {
    const unlock = () => simulator.unlockAudio()
    const onKey = (e: KeyboardEvent) => {
      unlock()
      if (e.code === 'F2') {
        e.preventDefault()
        const s = simulator.getSnapshot().settings
        simulator.updateSettings({ debug: !s.debug })
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', unlock)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', unlock)
    }
  }, [])
}
