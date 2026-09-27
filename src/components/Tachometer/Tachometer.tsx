import { RPM_USEFUL_MAX, RPM_USEFUL_MIN } from '../../simulation/constants'
import './Tachometer.css'

interface Props {
  rpm: number
  idleRpm: number
  redlineRpm: number
  maxRpm: number
  limiter: boolean
  running: boolean
}

const CX = 160
const CY = 160
const R = 128
const START = -135
const SWEEP = 270

function polar(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: CX + radius * Math.sin(a), y: CY - radius * Math.cos(a) }
}

function arc(fromAngle: number, toAngle: number, radius: number) {
  const p0 = polar(fromAngle, radius)
  const p1 = polar(toAngle, radius)
  const large = toAngle - fromAngle > 180 ? 1 : 0
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${large} 1 ${p1.x} ${p1.y}`
}

export function Tachometer({ rpm, idleRpm, redlineRpm, maxRpm, limiter, running }: Props) {
  const scaleMax = Math.ceil(maxRpm / 1000) * 1000
  const angleOf = (v: number) => START + (Math.min(Math.max(v, 0), scaleMax * 1.02) / scaleMax) * SWEEP
  const needle = angleOf(rpm)

  const zones = [
    { from: idleRpm - 200, to: idleRpm + 200, cls: 'zone-idle', label: 'Ralentí' },
    { from: RPM_USEFUL_MIN, to: RPM_USEFUL_MAX, cls: 'zone-useful', label: 'Zona útil' },
    { from: RPM_USEFUL_MAX, to: redlineRpm, cls: 'zone-high', label: 'Zona alta' },
    { from: redlineRpm, to: scaleMax, cls: 'zone-red', label: 'Redline' },
  ]

  const ticks = []
  for (let v = 0; v <= scaleMax; v += 250) {
    const major = v % 1000 === 0
    const half = v % 500 === 0
    const a = angleOf(v)
    const p0 = polar(a, R - 4)
    const p1 = polar(a, R - (major ? 22 : half ? 14 : 9))
    ticks.push(
      <line
        key={v}
        x1={p0.x}
        y1={p0.y}
        x2={p1.x}
        y2={p1.y}
        className={major ? 'tick tick-major' : 'tick'}
        data-red={v >= redlineRpm || undefined}
      />,
    )
    if (major) {
      const lp = polar(a, R - 38)
      ticks.push(
        <text key={`l${v}`} x={lp.x} y={lp.y} className="tick-label" data-red={v >= redlineRpm || undefined}>
          {v / 1000}
        </text>,
      )
    }
  }

  const status = !running ? 'off' : limiter ? 'redline' : rpm > redlineRpm - 500 ? 'high' : 'normal'

  return (
    <div className="tacho" data-status={status}>
      <svg viewBox="0 0 320 300" role="img" aria-label={`Tacómetro: ${Math.round(rpm)} RPM`}>
        <path d={arc(START, START + SWEEP, R)} className="track" />
        {zones.map((z) => (
          <path key={z.cls} d={arc(angleOf(z.from), angleOf(z.to), R + 8)} className={`zone ${z.cls}`}>
            <title>{z.label}</title>
          </path>
        ))}
        {ticks}
        <text x={CX} y={CY - 40} className="unit">
          RPM ×1000
        </text>
        <g className="needle" style={{ transform: `rotate(${needle}deg)` }}>
          <line x1={CX} y1={CY + 16} x2={CX} y2={CY - R + 14} />
        </g>
        <circle cx={CX} cy={CY} r={9} className="hub" />
      </svg>
      <div className="tacho-readout">
        <span className="tacho-rpm num">{Math.round(rpm).toLocaleString('es-ES')}</span>
        <span className="tacho-label">RPM</span>
      </div>
      <div className="tacho-lamps">
        <span className="lamp" data-on={!running || undefined}>
          MOTOR {running ? 'ON' : 'OFF'}
        </span>
        <span className="lamp lamp-red" data-on={limiter || undefined}>
          ⚠ REDLINE
        </span>
      </div>
    </div>
  )
}
