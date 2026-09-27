import type { AssistantItem, FeedbackMessage, LaunchEvaluation, ShiftEvaluation } from '../../training/types'
import './DrivingAssistant.css'

interface Props {
  items: AssistantItem[]
  feedback: FeedbackMessage[]
  enabled: boolean
  lastShift: ShiftEvaluation | null
  lastLaunch: LaunchEvaluation | null
}

const ICON: Record<AssistantItem['status'], string> = {
  ok: '✓',
  todo: '→',
  warn: '⚠',
  danger: '⚠',
  info: '•',
}

export function DrivingAssistant({ items, feedback, enabled, lastShift, lastLaunch }: Props) {
  return (
    <div className="assistant">
      {enabled ? (
        <ul className="assistant-list">
          {items.map((it) => (
            <li key={it.text} className={`as-item as-${it.status}`}>
              <span className="as-icon">{it.text.startsWith('⚠') ? '' : ICON[it.status]}</span>
              <span>{it.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim">Asistente desactivado en Configuración.</p>
      )}

      <div className="feedback" aria-live="polite">
        {feedback.map((m) => (
          <div key={m.id} className={`fb fb-${m.tone}`}>
            {m.text}
          </div>
        ))}
      </div>

      {(lastLaunch || lastShift) && (
        <div className="last-evals">
          {lastLaunch && (
            <div className="eval">
              <span className="eval-title">Última salida</span>
              <span className="num">
                {lastLaunch.stalled ? 'calado' : `${lastLaunch.frictionTime.toFixed(1)} s en fricción`} · máx{' '}
                {Math.round(lastLaunch.maxRpm)} RPM · gas medio {Math.round(lastLaunch.avgAccelerator * 100)}%
              </span>
            </div>
          )}
          {lastShift && (
            <div className="eval">
              <span className="eval-title">
                Último cambio {lastShift.from}→{lastShift.to}
              </span>
              <span className="num">
                {Math.round(lastShift.rpmBefore)} → {Math.round(lastShift.rpmAfter)} RPM · embrague{' '}
                {lastShift.clutchReleaseTime.toFixed(1)} s · tirón {lastShift.jolt.toFixed(1)} m/s²
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
