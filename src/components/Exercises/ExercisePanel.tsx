import { simulator } from '../../hooks/useSimulation'
import { EXERCISES, getExercise, type ExerciseStatus } from '../../training/exercises'
import { formatDuration } from '../../training/history'
import './Exercises.css'

export function ExercisePanel({ status }: { status: ExerciseStatus }) {
  const def = getExercise(status.id)
  if (!def) return null
  const isLast = EXERCISES[EXERCISES.length - 1].id === def.id

  return (
    <section className="panel exercise-panel" data-state={status.state}>
      <div className="exercise-main">
        <div className="exercise-number">Ejercicio {def.number}</div>
        <h2>{def.title}</h2>
        <p className="exercise-goal">🎯 {def.goal}</p>
        <details className="exercise-steps-toggle">
          <summary>Pasos ({def.steps.length})</summary>
          <ol className="exercise-steps">
            {def.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      </div>
      <div className="exercise-side">
        <div className="exercise-meta num muted">
          Intento {status.attempts} · {formatDuration(status.elapsed)}
        </div>
        {status.state === 'running' && <div className="exercise-result running">En curso…</div>}
        {status.state === 'success' && <div className="exercise-result success">✓ Superado. {status.message}</div>}
        {status.state === 'fail' && <div className="exercise-result fail">✗ {status.message}</div>}
        <div className="row">
          <button className="btn" onClick={() => simulator.restart()}>
            ↺ Reintentar
          </button>
          {status.state === 'success' && (
            <button className="btn btn-primary" onClick={() => simulator.nextExercise()}>
              {isLast ? 'Ver ejercicios' : 'Siguiente →'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => simulator.startFreePractice()}>
            Práctica libre
          </button>
        </div>
      </div>
    </section>
  )
}
