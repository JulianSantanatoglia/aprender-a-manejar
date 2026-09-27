import { Effects } from './effects'
import { EngineSound } from './engineSound'

export type SoundEffect = 'shift' | 'grind' | 'stall' | 'starter' | 'alert' | 'highRpm' | 'brake' | 'success'

/**
 * Punto único de audio. El AudioContext solo puede crearse/reanudarse tras
 * un gesto del usuario (clic o tecla), por eso existe `unlock()`.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private engine: EngineSound | null = null
  private effects: Effects | null = null
  private enabled = true
  private volume = 0.6

  isUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  unlock() {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.enabled ? this.volume : 0
      this.master.connect(this.ctx.destination)
      this.engine = new EngineSound(this.ctx, this.master)
      this.effects = new Effects(this.ctx, this.master)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    this.applyVolume()
  }

  setVolume(volume: number) {
    this.volume = volume
    this.applyVolume()
  }

  private applyVolume() {
    if (!this.master || !this.ctx) return
    this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.05)
  }

  /** Silencia el motor (pausa, otras pantallas). */
  mute() {
    this.engine?.update(0, 0, false, 1)
  }

  updateEngine(rpm: number, load: number, running: boolean, redline: number) {
    if (!this.enabled || !this.isUnlocked()) return
    this.engine?.update(rpm, load, running, redline)
  }

  play(effect: SoundEffect) {
    if (!this.enabled || !this.isUnlocked() || !this.effects) return
    this.effects[effect]()
  }
}
