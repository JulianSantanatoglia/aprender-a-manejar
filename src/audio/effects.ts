import { makeNoiseBuffer } from './engineSound'

/** Efectos cortos. Cada efecto crea nodos efímeros que se liberan al terminar. */
export class Effects {
  private ctx: AudioContext
  private out: AudioNode
  private noise: AudioBuffer

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx
    this.out = destination
    this.noise = makeNoiseBuffer(ctx, 1)
  }

  private envelope(peak: number, attack: number, decay: number, start = this.ctx.currentTime): GainNode {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, start)
    g.gain.linearRampToValueAtTime(peak, start + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay)
    g.connect(this.out)
    return g
  }

  private tone(type: OscillatorType, freq: number, peak: number, duration: number, start = this.ctx.currentTime, endFreq?: number) {
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration)
    osc.connect(this.envelope(peak, 0.005, duration, start))
    osc.start(start)
    osc.stop(start + duration + 0.05)
  }

  private noiseBurst(peak: number, duration: number, filterType: BiquadFilterType, freq: number, start = this.ctx.currentTime) {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const f = this.ctx.createBiquadFilter()
    f.type = filterType
    f.frequency.value = freq
    src.connect(f).connect(this.envelope(peak, 0.003, duration, start))
    src.start(start, Math.random() * 0.5)
    src.stop(start + duration + 0.05)
  }

  /** "Clonc" mecánico de la palanca. */
  shift() {
    this.noiseBurst(0.25, 0.06, 'bandpass', 1800)
    this.tone('sine', 110, 0.25, 0.08)
  }

  /** Rascado de piñones (cambio sin embrague). */
  grind() {
    const t = this.ctx.currentTime
    for (let i = 0; i < 6; i++) this.noiseBurst(0.18, 0.035, 'highpass', 2500, t + i * 0.04)
    this.tone('sawtooth', 240, 0.08, 0.25, t, 180)
  }

  /** Motor calado: sacudida grave que se apaga. */
  stall() {
    const t = this.ctx.currentTime
    for (let i = 0; i < 3; i++) this.tone('sine', 45 - i * 8, 0.35, 0.12, t + i * 0.1)
    this.noiseBurst(0.12, 0.3, 'lowpass', 300, t)
  }

  /** Motor de arranque. */
  starter() {
    const t = this.ctx.currentTime
    for (let i = 0; i < 6; i++) this.tone('sawtooth', 140 + i * 6, 0.08, 0.07, t + i * 0.075)
    this.noiseBurst(0.15, 0.25, 'lowpass', 500, t + 0.45)
  }

  /** Aviso. */
  alert() {
    const t = this.ctx.currentTime
    this.tone('square', 880, 0.07, 0.09, t)
    this.tone('square', 880, 0.07, 0.09, t + 0.14)
  }

  /** Aviso de RPM alta (luz de cambio). */
  highRpm() {
    this.tone('sine', 1320, 0.06, 0.07)
  }

  /** Chirrido de neumáticos en frenada brusca. */
  brake() {
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(900, t)
    osc.frequency.linearRampToValueAtTime(700, t + 0.5)
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 1200
    f.Q.value = 6
    osc.connect(f).connect(this.envelope(0.08, 0.03, 0.5, t))
    osc.start(t)
    osc.stop(t + 0.6)
  }

  /** Ejercicio superado. */
  success() {
    const t = this.ctx.currentTime
    this.tone('sine', 660, 0.1, 0.12, t)
    this.tone('sine', 990, 0.1, 0.2, t + 0.12)
  }
}
