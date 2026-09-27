import { STANDARD_BUTTONS } from '../../input/GamepadMapping'
import type { GamepadDiagnostics as Diagnostics } from '../../input/types'

const pct = (v: number) => `${Math.round(v * 100)}%`

function AnalogRow({ label, raw, value }: { label: string; raw: number; value: number }) {
  return (
    <div className="diag-analog">
      <div className="diag-analog-head">
        <span>{label}</span>
        <span className="num">
          {pct(value)} <span className="dim">(bruto {raw.toFixed(3)})</span>
        </span>
      </div>
      <div className="bar diag-bar">
        <div className="bar-fill" style={{ width: pct(value) }} />
      </div>
    </div>
  )
}

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="diag-dot" data-on={on || undefined}>
      <span className="diag-dot-led">{on ? '●' : '○'}</span>
      <span>{label}</span>
    </div>
  )
}

export function GamepadDiagnostics({ d }: { d: Diagnostics }) {
  const b = (i: number) => d.buttons[i]?.pressed ?? false
  const axis = (i: number) => (d.axes[i] ?? 0).toFixed(2)

  if (!d.connected) {
    return (
      <div className="diag-empty">
        <p className="diag-empty-title">○ DUALSENSE NO DETECTADO</p>
        <p>No se ha detectado ningún mando.</p>
        <p className="muted">Conecta el DualSense mediante USB-C y pulsa cualquier botón.</p>
        <p className="dim">Los navegadores solo exponen el mando después de pulsar un botón con la página abierta. Chrome y Edge son los más compatibles.</p>
      </div>
    )
  }

  return (
    <div className="diag">
      <div className="diag-info">
        <div>
          <span className="dim">Gamepad</span>
          <strong>{d.id}</strong>
        </div>
        <div>
          <span className="dim">Connected</span>
          <strong className="ok-text">YES</strong>
        </div>
        <div>
          <span className="dim">Mapping</span>
          <strong>{d.mapping || 'no estándar'}</strong>
        </div>
      </div>
      {d.mapping !== 'standard' && (
        <p className="diag-warning">
          ⚠ Este navegador no expone el mapeo estándar. Revisa y reasigna los controles en Configuración → Controles.
        </p>
      )}

      <AnalogRow label="L2 EMBRAGUE" raw={d.raw.clutch} value={d.processed.clutch} />
      <AnalogRow label="R2 ACELERADOR" raw={d.raw.accelerator} value={d.processed.accelerator} />

      <div className="diag-dots">
        <Dot on={b(STANDARD_BUTTONS.L1)} label="L1 FRENO" />
        <Dot on={b(STANDARD_BUTTONS.dpadUp)} label="D-PAD ↑" />
        <Dot on={b(STANDARD_BUTTONS.dpadDown)} label="D-PAD ↓" />
        <Dot on={b(STANDARD_BUTTONS.dpadLeft)} label="D-PAD ←" />
        <Dot on={b(STANDARD_BUTTONS.dpadRight)} label="D-PAD →" />
        <Dot on={b(STANDARD_BUTTONS.triangle)} label="△" />
        <Dot on={b(STANDARD_BUTTONS.circle)} label="○" />
        <Dot on={b(STANDARD_BUTTONS.cross)} label="✕" />
        <Dot on={b(STANDARD_BUTTONS.square)} label="□" />
        <Dot on={b(STANDARD_BUTTONS.options)} label="OPTIONS" />
        <Dot on={b(STANDARD_BUTTONS.share)} label="SHARE" />
        <Dot on={b(STANDARD_BUTTONS.R1)} label="R1" />
      </div>

      <div className="diag-axes num">
        <div className="diag-sub">Axes</div>
        <div>Left X: {axis(0)}</div>
        <div>Left Y: {axis(1)}</div>
        <div>Right X: {axis(2)}</div>
        <div>Right Y: {axis(3)}</div>
        {d.axes.slice(4).map((v, i) => (
          <div key={i}>
            Eje {i + 4}: {v.toFixed(2)}
          </div>
        ))}
      </div>

      <details className="diag-raw">
        <summary>Todos los botones ({d.buttons.length})</summary>
        <div className="diag-buttons num">
          {d.buttons.map((btn, i) => (
            <span key={i} className="diag-btn" data-on={btn.pressed || undefined}>
              {i}: {btn.value.toFixed(2)}
            </span>
          ))}
        </div>
      </details>
    </div>
  )
}
