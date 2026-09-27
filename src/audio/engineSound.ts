/**
 * Sonido de motor sintetizado. Los nodos se crean una sola vez y solo se
 * modulan sus parámetros en cada frame (frecuencia, filtro, volumen).
 *
 * Frecuencia de encendido de un 4 cilindros de 4 tiempos: 2 explosiones por vuelta.
 */
export class EngineSound {
  private ctx: AudioContext
  private output: GainNode
  private oscillators: OscillatorNode[] = []
  private filter: BiquadFilterNode
  private noise: AudioBufferSourceNode
  private noiseFilter: BiquadFilterNode
  private noiseGain: GainNode
  private harmonicGains: GainNode[] = []

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx
    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.output.connect(destination)

    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.Q.value = 2
    this.filter.frequency.value = 600

    const shaper = ctx.createWaveShaper()
    shaper.curve = makeDistortionCurve(8)
    shaper.connect(this.filter)
    this.filter.connect(this.output)

    // Fundamental, sub-armónico (rumor) y 2º armónico.
    const specs: Array<[OscillatorType, number]> = [
      ['sawtooth', 0.55],
      ['triangle', 0.5],
      ['square', 0.12],
    ]
    for (const [type, level] of specs) {
      const osc = ctx.createOscillator()
      osc.type = type
      const g = ctx.createGain()
      g.gain.value = level
      osc.connect(g).connect(shaper)
      osc.start()
      this.oscillators.push(osc)
      this.harmonicGains.push(g)
    }

    // Ruido de admisión (aumenta con la carga).
    this.noise = ctx.createBufferSource()
    this.noise.buffer = makeNoiseBuffer(ctx)
    this.noise.loop = true
    this.noiseFilter = ctx.createBiquadFilter()
    this.noiseFilter.type = 'bandpass'
    this.noiseFilter.Q.value = 0.8
    this.noiseGain = ctx.createGain()
    this.noiseGain.gain.value = 0
    this.noise.connect(this.noiseFilter).connect(this.noiseGain).connect(this.output)
    this.noise.start()
  }

  /** `load` = mariposa 0–1; `ratio` = rpm / redline. */
  update(rpm: number, load: number, running: boolean, redline: number) {
    const now = this.ctx.currentTime
    const ratio = Math.min(1.2, rpm / redline)
    const firing = Math.max(8, (rpm / 60) * 2)
    const tc = 0.03

    this.oscillators[0].frequency.setTargetAtTime(firing, now, tc)
    this.oscillators[1].frequency.setTargetAtTime(firing / 2, now, tc)
    this.oscillators[2].frequency.setTargetAtTime(firing * 2, now, tc)

    this.filter.frequency.setTargetAtTime(250 + ratio * 1600 + load * 1400, now, tc)
    this.noiseFilter.frequency.setTargetAtTime(500 + ratio * 2500, now, tc)
    this.noiseGain.gain.setTargetAtTime(running ? 0.015 + load * 0.07 * (0.3 + ratio) : 0, now, tc)

    const volume = running ? 0.16 + load * 0.22 + ratio * 0.12 : 0
    this.output.gain.setTargetAtTime(volume, now, running ? 0.04 : 0.15)
  }

  dispose() {
    this.oscillators.forEach((o) => o.stop())
    this.noise.stop()
    this.output.disconnect()
  }
}

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x))
  }
  return curve
}

export function makeNoiseBuffer(ctx: BaseAudioContext, seconds = 1): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}
