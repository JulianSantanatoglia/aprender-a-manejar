import type { Gear } from '../../simulation/types'
import './GearIndicator.css'

interface Props {
  gear: Gear
  suggestion?: string | null
}

export function GearIndicator({ gear, suggestion }: Props) {
  const kind = gear === 'N' ? 'neutral' : gear === 'R' ? 'reverse' : 'forward'
  return (
    <div className="gear-indicator" data-kind={kind}>
      <span className="gear-caption">MARCHA</span>
      <span key={String(gear)} className="gear-value">
        {gear}
      </span>
      {suggestion && <span className="gear-suggestion">{suggestion}</span>}
    </div>
  )
}
