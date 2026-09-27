import type { Gear } from '../../simulation/types'
import './GearShift.css'

/** Posiciones de la palanca en el patrón H (preparado para un futuro modo con joystick). */
const H_PATTERN: Record<string, { x: number; y: number }> = {
  '1': { x: 70, y: 34 },
  '2': { x: 70, y: 146 },
  '3': { x: 160, y: 34 },
  '4': { x: 160, y: 146 },
  '5': { x: 250, y: 34 },
  R: { x: 250, y: 146 },
  N: { x: 160, y: 90 },
}

const GATES = ['1', '2', '3', '4', '5', 'R'] as const

interface Props {
  gear: Gear
  clutchPressed: boolean
}

export function GearShift({ gear, clutchPressed }: Props) {
  const pos = H_PATTERN[String(gear)]
  return (
    <div className="gearshift">
      <svg viewBox="0 0 320 180" role="img" aria-label={`Palanca de cambios en ${gear}`}>
        <g className="gate">
          <line x1={70} y1={90} x2={250} y2={90} />
          {[70, 160, 250].map((x) => (
            <line key={x} x1={x} y1={34} x2={x} y2={146} />
          ))}
        </g>
        {GATES.map((g) => {
          const p = H_PATTERN[g]
          const top = p.y < 90
          return (
            <text
              key={g}
              x={p.x + 26}
              y={top ? p.y + 4 : p.y + 4}
              className="gate-label"
              data-active={String(gear) === g || undefined}
              data-reverse={g === 'R' || undefined}
            >
              {g}
            </text>
          )
        })}
        <text x={160 + 26} y={94} className="gate-label gate-n" data-active={gear === 'N' || undefined}>
          N
        </text>
        <g className="knob" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
          <circle r={17} className="knob-outer" />
          <circle r={9} className="knob-inner" />
        </g>
      </svg>
      <div className="gearshift-hint">
        {clutchPressed ? <span className="ok">Embrague pisado: puedes cambiar</span> : <span className="dim">Pisa el embrague para cambiar</span>}
      </div>
    </div>
  )
}
