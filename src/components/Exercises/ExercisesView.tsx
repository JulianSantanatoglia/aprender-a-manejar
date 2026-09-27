import { simulator, useSimulation } from '../../hooks/useSimulation'
import { EXERCISES } from '../../training/exercises'
import { formatDuration } from '../../training/history'
import './Exercises.css'

export function ExercisesView() {
  const s = useSimulation()
  return (
    <div className="stack">
      <section className="panel free-card">
        <div>
          <h2>Práctica libre</h2>
          <p className="muted">Sin límite de tiempo: salidas, cambios, reducciones, frenadas y marcha atrás.</p>
        </div>
        <button className="btn btn-primary" onClick={() => simulator.startFreePractice()}>
          Empezar
        </button>
      </section>

      <div className="exercise-grid">
        {EXERCISES.map((ex) => {
          const record = s.exerciseRecords[ex.id]
          return (
            <section key={ex.id} className="panel exercise-card" data-done={record ? true : undefined}>
              <div className="exercise-number">
                Ejercicio {ex.number}
                {record && <span className="done-badge">✓ Superado</span>}
              </div>
              <h3>{ex.title}</h3>
              <p className="muted">{ex.goal}</p>
              {record && (
                <p className="dim num">
                  Mejor tiempo {formatDuration(record.bestTime)} · {record.attempts} intento{record.attempts === 1 ? '' : 's'}
                </p>
              )}
              <div className="spacer" />
              <button className="btn" onClick={() => simulator.startExercise(ex.id)}>
                {record ? 'Repetir' : 'Empezar'}
              </button>
            </section>
          )
        })}
      </div>
    </div>
  )
}
