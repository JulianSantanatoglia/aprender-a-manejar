import { formatDuration } from '../../training/history'
import { getExercise } from '../../training/exercises'
import type { DrivingSession } from '../../training/types'
import './SessionSummary.css'

export function MetricBar({ label, value }: { label: string; value: number | null }) {
  const tone = value === null ? 'none' : value >= 80 ? 'good' : value >= 55 ? 'mid' : 'low'
  return (
    <div className="metric" data-tone={tone}>
      <div className="metric-head">
        <span>{label}</span>
        <span className="num">{value === null ? '—' : `${value}%`}</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  )
}

export function SessionStats({ s }: { s: DrivingSession }) {
  const stats: Array<[string, string]> = [
    ['Duración', formatDuration(s.duration)],
    ['Calados', String(s.stalls)],
    ['Cambios correctos', String(s.smoothChanges)],
    ['Cambios bruscos', String(s.roughChanges)],
    ['Frenadas bruscas', String(s.hardBrakes)],
    ['Salidas', String(s.launches)],
    ['Velocidad máx.', `${Math.round(s.maxSpeed)} km/h`],
    ['RPM máx.', Math.round(s.maxRPM).toLocaleString('es-ES')],
    ['Distancia', s.distanceMeters >= 1000 ? `${(s.distanceMeters / 1000).toFixed(2)} km` : `${Math.round(s.distanceMeters)} m`],
  ]
  return (
    <div className="stats">
      {stats.map(([k, v]) => (
        <div key={k} className="stat">
          <span className="stat-value num">{v}</span>
          <span className="stat-label">{k}</span>
        </div>
      ))}
    </div>
  )
}

export function SessionMetrics({ s }: { s: DrivingSession }) {
  return (
    <div className="metrics">
      <MetricBar label="Control del embrague" value={s.clutchControl} />
      <MetricBar label="Control de RPM" value={s.rpmControl} />
      <MetricBar label="Suavidad" value={s.smoothness} />
    </div>
  )
}

interface Props {
  session: DrivingSession
  onClose: () => void
  onHistory: () => void
}

export function SessionSummary({ session, onClose, onHistory }: Props) {
  const exercise = session.exerciseId ? getExercise(session.exerciseId) : null
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="summary-title">
      <div className="modal">
        <h2 id="summary-title">Resumen de la sesión</h2>
        <p className="muted">
          {new Date(session.startTime).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
          {exercise ? `Ejercicio ${exercise.number}: ${exercise.title}` : 'Práctica libre'}
        </p>
        <SessionMetrics s={session} />
        <SessionStats s={session} />
        {session.duration < 10 && <p className="dim">Sesiones de menos de 10 s no se guardan en el historial.</p>}
        <div className="row modal-actions">
          <button className="btn" onClick={onHistory}>
            Ver historial
          </button>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            Nueva sesión
          </button>
        </div>
      </div>
    </div>
  )
}
