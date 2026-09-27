import { describeGamepadBinding, describeKey } from '../../input/GamepadMapping'
import { ACTION_LABELS, type ActionId, type DeviceKind, type GamepadBindings, type KeyboardBindings } from '../../input/types'

const GAMEPAD_ACTIONS: ActionId[] = ['clutch', 'accelerator', 'brake', 'gearUp', 'gearDown', 'neutral', 'reverse', 'gear5', 'start', 'pause', 'restart']
const KEYBOARD_ACTIONS: ActionId[] = ['clutch', 'brake', 'accelerator', 'gear1', 'gear2', 'gear3', 'gear4', 'gear5', 'reverse', 'neutral', 'start', 'pause']

interface Props {
  device: DeviceKind
  gamepad: GamepadBindings
  keyboard: KeyboardBindings
}

export function ControlsLegend({ device, gamepad, keyboard }: Props) {
  const rows: Array<[string, string]> =
    device === 'gamepad'
      ? GAMEPAD_ACTIONS.filter((a) => gamepad[a]).map((a) => [describeGamepadBinding(gamepad[a]), ACTION_LABELS[a]])
      : KEYBOARD_ACTIONS.filter((a) => keyboard[a]?.length).map((a) => [describeKey(keyboard[a]![0]), ACTION_LABELS[a]])

  return (
    <div className="legend">
      <div className="legend-title">{device === 'gamepad' ? 'Controles del mando' : 'Controles de teclado'}</div>
      <dl>
        {rows.map(([k, v]) => (
          <div key={v} className="legend-row">
            <dt>
              <span className="kbd">{k}</span>
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
