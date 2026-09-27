import { isInFrictionZone } from '../../simulation/clutch'
import { FRICTION_ZONE_HALF_WIDTH } from '../../simulation/constants'
import './Pedals.css'

interface Props {
  clutch: number
  brake: number
  accelerator: number
  engagement: number
  bitePoint: number
  inGear: boolean
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/** Pedales: representan exactamente el InputState. */
export function Pedals({ clutch, brake, accelerator, engagement, bitePoint, inGear }: Props) {
  const inZone = isInFrictionZone(clutch, bitePoint)
  const zoneFrom = Math.max(0, bitePoint - FRICTION_ZONE_HALF_WIDTH)
  const zoneTo = Math.min(1, bitePoint + FRICTION_ZONE_HALF_WIDTH)

  return (
    <div className="pedals">
      <div className="pedal" data-kind="clutch">
        <div className="pedal-head">
          <span className="pedal-name">Embrague</span>
          <span className={`friction-badge ${inZone ? 'on' : ''}`}>🔥 PUNTO DE FRICCIÓN</span>
          <span className="pedal-value num">{pct(clutch)}</span>
        </div>
        <div className="bar pedal-bar">
          <div className="friction-zone" style={{ left: pct(zoneFrom), width: pct(zoneTo - zoneFrom) }} />
          <div className="bar-fill" style={{ width: pct(clutch) }} data-zone={inZone || undefined} />
          <div className="bite-marker" style={{ left: pct(bitePoint) }} />
        </div>
        <div className="pedal-scale">
          <span>SUELTO</span>
          <span className="bite-label" style={{ left: pct(bitePoint) }}>
            ▲ fricción
          </span>
          <span>PISADO</span>
        </div>
        <div className="engagement">
          <span className="muted">Transmisión {inGear ? '' : '(N)'}</span>
          <div className="bar bar-thin">
            <div className="bar-fill" style={{ width: pct(inGear ? engagement : 0) }} />
          </div>
          <span className="num">{pct(inGear ? engagement : 0)}</span>
        </div>
      </div>

      <div className="pedal" data-kind="brake">
        <div className="pedal-head">
          <span className="pedal-name">Freno</span>
          <span className="pedal-value num">{pct(brake)}</span>
        </div>
        <div className="bar pedal-bar">
          <div className="bar-fill" style={{ width: pct(brake) }} />
        </div>
      </div>

      <div className="pedal" data-kind="accelerator">
        <div className="pedal-head">
          <span className="pedal-name">Acelerador</span>
          <span className="pedal-value num">{pct(accelerator)}</span>
        </div>
        <div className="bar pedal-bar">
          <div className="launch-zone" title="Zona recomendada para salir: 15–25 %" />
          <div className="bar-fill" style={{ width: pct(accelerator) }} />
        </div>
      </div>
    </div>
  )
}
