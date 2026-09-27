import type { InputState } from '../../input/types'
import type { VehicleTelemetry } from '../../simulation/types'
import './DebugPanel.css'

interface Props {
  input: InputState
  vehicle: VehicleTelemetry
  device: string
}

const f = (v: number, d = 2) => v.toFixed(d)

export function DebugPanel({ input, vehicle: v, device }: Props) {
  const sections: Array<[string, Array<[string, string]>]> = [
    [
      'INPUT',
      [
        ['Device', device],
        ['Clutch', f(input.clutch)],
        ['Accelerator', f(input.accelerator)],
        ['Brake', f(input.brake)],
      ],
    ],
    [
      'VEHICLE',
      [
        ['Speed', `${f(v.speedKmh, 1)} km/h`],
        ['RPM', f(v.rpm, 0)],
        ['Gear', String(v.gear)],
        ['Accel', `${f(v.accelerationMs2)} m/s²`],
        ['Distance', `${f(v.distanceMeters, 0)} m`],
      ],
    ],
    [
      'CLUTCH',
      [
        ['Pedal', f(v.clutchPedal)],
        ['Engagement', f(v.clutchEngagement)],
        ['Capacity', `${f(v.clutchCapacity, 0)} Nm`],
        ['Torque', `${f(v.clutchTorque, 0)} Nm`],
        ['Slip', `${f(v.clutchSlipRpm, 0)} RPM`],
        ['Drivetrain', `${f(v.drivetrainRpm, 0)} RPM`],
        ['Jolt', `${f(v.jolt)} m/s²`],
      ],
    ],
    [
      'ENGINE',
      [
        ['Running', v.engineRunning ? 'yes' : v.stalled ? 'STALLED' : 'no'],
        ['Throttle', f(v.throttle)],
        ['Torque', `${f(v.engineTorque, 0)} Nm`],
        ['Wheel torque', `${f(v.wheelTorque, 0)} Nm`],
        ['Limiter', v.limiterActive ? 'ON' : 'off'],
      ],
    ],
  ]

  return (
    <div className="debug">
      {sections.map(([title, rows]) => (
        <div key={title} className="debug-section">
          <div className="debug-title">{title}</div>
          {rows.map(([k, val]) => (
            <div key={k} className="debug-row">
              <span>{k}</span>
              <span>{val}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
