import { simulator, useSimulation } from '../../hooks/useSimulation'
import { getExercise } from '../../training/exercises'
import { formatDuration } from '../../training/history'
import { SessionMetrics, SessionStats } from '../SessionSummary/SessionSummary'
import './History.css'

export function HistoryView() {
  const { history } = useSimulation()

  if (history.length === 0) {
    return (
      <section className="panel history-empty">
        <h2>Historial</h2>
        <p className="muted">Todavía no hay sesiones guardadas. Termina una sesión de al menos 10 segundos para verla aquí.</p>
      </section>
    )
  }

  return (
    <div className="stack">
      <div className="row">
        <h2>Historial</h2>
        <span className="muted">{history.length} sesiones</span>
        <span className="spacer" />
        <button
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (window.confirm('¿Borrar todo el historial de sesiones?')) simulator.clearHistory()
          }}
        >
          Borrar historial
        </button>
      </div>
      {history.map((s) => {
        const ex = s.exerciseId ? getExercise(s.exerciseId) : null
        return (
          <details key={s.id} className="panel history-item">
            <summary>
              <span className="history-date num">
                {new Date(s.startTime).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                <span className="dim">{new Date(s.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
              <span className="history-mode">{ex ? `Ejercicio ${ex.number}: ${ex.title}` : 'Práctica libre'}</span>
              <span className="num">Duración: {formatDuration(s.duration)}</span>
              <span className="num">Calados: {s.stalls}</span>
              <span className="num">Cambios correctos: {s.smoothChanges}</span>
              <span className="num">Cambios bruscos: {s.roughChanges}</span>
            </summary>
            <div className="history-detail">
              <SessionMetrics s={s} />
              <SessionStats s={s} />
            </div>
          </details>
        )
      })}
    </div>
  )
}
