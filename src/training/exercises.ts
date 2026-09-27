import type { VehicleTelemetry } from '../simulation/types'
import type { InitialCondition } from '../simulation/vehicle'
import type { LaunchEvaluation, ShiftEvaluation } from './types'

export interface ExerciseOutcome {
  result: 'success' | 'fail'
  message: string
}

/** Memoria de trabajo de un intento (se reinicia en cada intento). */
export interface ExerciseScratch {
  holdTime: number
}

export interface ExerciseDefinition {
  id: string
  number: number
  title: string
  goal: string
  steps: string[]
  initial: InitialCondition
  onFrame?(t: VehicleTelemetry, dt: number, s: ExerciseScratch): ExerciseOutcome | null
  onShift?(e: ShiftEvaluation): ExerciseOutcome | null
  onLaunch?(e: LaunchEvaluation): ExerciseOutcome | null
  onStall?(t: VehicleTelemetry): ExerciseOutcome | null
}

const stallFail = (message: string) => (): ExerciseOutcome => ({ result: 'fail', message })

function shiftCheck(from: number, to: number) {
  return (e: ShiftEvaluation): ExerciseOutcome | null => {
    if (e.from !== from || e.to !== to) return null
    if (e.quality === 'smooth' || e.quality === 'acceptable') return { result: 'success', message: e.message }
    return { result: 'fail', message: e.message }
  }
}

export const EXERCISES: ExerciseDefinition[] = [
  {
    id: 'launch',
    number: 1,
    title: 'Salida desde parado',
    goal: 'Llega de 0 a 20 km/h sin calar el motor.',
    steps: [
      'Pisa el embrague a fondo (L2).',
      'Mete primera (D-Pad ↑).',
      'Acelera ligeramente, 15–25 % (R2).',
      'Suelta el embrague despacio hasta notar el punto de fricción.',
      'Cuando el coche avance, termina de soltar el embrague y acelera.',
    ],
    initial: {},
    onFrame: (t) =>
      t.speedKmh >= 20 && t.engineRunning ? { result: 'success', message: '¡Objetivo conseguido! 0 → 20 km/h sin calar.' } : null,
    onStall: stallFail('Motor calado. Pisa el embrague, arranca y vuelve a intentarlo soltando más despacio.'),
  },
  {
    id: 'shift-1-2',
    number: 2,
    title: '1ª → 2ª',
    goal: 'Sal en primera y haz un cambio suave a segunda.',
    steps: [
      'Sal en primera y acelera hasta ~2.500–3.000 RPM.',
      'Suelta el acelerador y pisa el embrague a fondo.',
      'Mete segunda.',
      'Suelta el embrague progresivamente.',
      'Vuelve a acelerar.',
    ],
    initial: {},
    onShift: shiftCheck(1, 2),
    onStall: stallFail('Motor calado. Reinicia el ejercicio e inténtalo de nuevo.'),
  },
  {
    id: 'shift-2-3',
    number: 3,
    title: '2ª → 3ª',
    goal: 'Circulando en segunda, cambia a tercera sin tirones.',
    steps: [
      'Vas en segunda a 25 km/h. Acelera hasta ~2.500–3.000 RPM.',
      'Suelta el acelerador y pisa el embrague.',
      'Mete tercera y suelta el embrague progresivamente.',
    ],
    initial: { gear: 2, speedKmh: 25 },
    onShift: shiftCheck(2, 3),
    onStall: stallFail('Motor calado: la marcha era demasiado larga para esa velocidad.'),
  },
  {
    id: 'shift-3-2',
    number: 4,
    title: '3ª → 2ª (reducción)',
    goal: 'Reduce de tercera a segunda sin un tirón brusco.',
    steps: [
      'Vas en tercera a 45 km/h.',
      'Suelta el acelerador y pisa el embrague.',
      'Mete segunda: las RPM tendrán que subir.',
      'Suelta el embrague muy progresivamente (o da un toque de gas antes de soltar).',
    ],
    initial: { gear: 3, speedKmh: 45 },
    onShift: shiftCheck(3, 2),
    onStall: stallFail('Motor calado. Reinicia el ejercicio.'),
  },
  {
    id: 'brake-stop',
    number: 5,
    title: 'Frenar y detenerse',
    goal: 'Detén el coche por completo sin calar y deja punto muerto.',
    steps: [
      'Vas en tercera a 50 km/h.',
      'Frena de forma progresiva (L1).',
      'Antes de que las RPM bajen de ~1.000, pisa el embrague.',
      'Detén el coche y pon punto muerto (✕).',
    ],
    initial: { gear: 3, speedKmh: 50 },
    onFrame: (t, dt, s) => {
      const stoppedSafely = t.engineRunning && t.speedKmh === 0 && t.gear === 'N'
      s.holdTime = stoppedSafely ? s.holdTime + dt : 0
      return s.holdTime > 0.5 ? { result: 'success', message: 'Parada correcta: embrague a tiempo y punto muerto.' } : null
    },
    onStall: stallFail('Se ha calado: pisa el embrague antes de que las RPM caigan por debajo de ~1.000.'),
  },
  {
    id: 'reverse',
    number: 6,
    title: 'Marcha atrás',
    goal: 'Mete marcha atrás y retrocede a 5 km/h sin calar.',
    steps: [
      'Con el coche parado, pisa el embrague a fondo.',
      'Mete marcha atrás (○).',
      'Acelera ligeramente y suelta el embrague despacio.',
    ],
    initial: {},
    onFrame: (t) =>
      t.gear === 'R' && t.speedKmh <= -5 ? { result: 'success', message: 'Marcha atrás controlada.' } : null,
    onStall: stallFail('Motor calado. La marcha atrás es corta: suelta el embrague todavía más despacio.'),
  },
]

export function getExercise(id: string): ExerciseDefinition | undefined {
  return EXERCISES.find((e) => e.id === id)
}

export type ExerciseState = 'running' | 'success' | 'fail'

export interface ExerciseStatus {
  id: string
  state: ExerciseState
  message: string | null
  attempts: number
  elapsed: number
}

/** Ejecuta un ejercicio y decide cuándo se ha superado o fallado. */
export class ExerciseTracker {
  readonly def: ExerciseDefinition
  private status: ExerciseStatus
  private scratch: ExerciseScratch = { holdTime: 0 }

  constructor(def: ExerciseDefinition) {
    this.def = def
    this.status = { id: def.id, state: 'running', message: null, attempts: 1, elapsed: 0 }
  }

  get(): ExerciseStatus {
    return this.status
  }

  retry() {
    this.scratch = { holdTime: 0 }
    this.status = { ...this.status, state: 'running', message: null, attempts: this.status.attempts + 1, elapsed: 0 }
  }

  private apply(o: ExerciseOutcome | null | undefined): boolean {
    if (!o || this.status.state !== 'running') return false
    this.status = { ...this.status, state: o.result, message: o.message }
    return true
  }

  onFrame(t: VehicleTelemetry, dt: number): boolean {
    if (this.status.state !== 'running') return false
    this.status = { ...this.status, elapsed: this.status.elapsed + dt }
    return this.apply(this.def.onFrame?.(t, dt, this.scratch))
  }

  onShift(e: ShiftEvaluation): boolean {
    return this.apply(this.def.onShift?.(e))
  }

  onLaunch(e: LaunchEvaluation): boolean {
    return this.apply(this.def.onLaunch?.(e))
  }

  onStall(t: VehicleTelemetry): boolean {
    return this.apply(this.def.onStall?.(t))
  }
}
