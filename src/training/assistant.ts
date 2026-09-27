import { isInFrictionZone } from '../simulation/clutch'
import { CLUTCH_PRESSED_THRESHOLD, RPM_LOW_WARNING, RPM_LUGGING } from '../simulation/constants'
import { drivetrainRpm } from '../simulation/physics'
import type { ForwardGear, VehicleConfig, VehicleTelemetry } from '../simulation/types'
import type { AssistantItem } from './types'

const UPSHIFT_HINT_RPM = 2800

/** Marcha más alta que deja el motor por encima de ~1.600 RPM a esta velocidad. */
export function recommendedGear(speedKmh: number): ForwardGear {
  const gears: ForwardGear[] = [5, 4, 3, 2, 1]
  for (const g of gears) {
    if (drivetrainRpm(Math.abs(speedKmh), g) >= 1600) return g
  }
  return 1
}

export interface AssistantContext {
  startLabel: string
}

/**
 * Asistente de conducción (sección 39): analiza el estado continuamente
 * y devuelve una lista de comprobaciones y sugerencias.
 */
export function analyzeDriving(t: VehicleTelemetry, cfg: VehicleConfig, ctx: AssistantContext): AssistantItem[] {
  const items: AssistantItem[] = []
  const clutchPressed = t.clutchPedal >= CLUTCH_PRESSED_THRESHOLD
  const stopped = Math.abs(t.speedKmh) < 1
  const gearName = t.gear === 'R' ? 'marcha atrás' : t.gear === 'N' ? 'punto muerto' : `${t.gear}ª`

  if (!t.engineRunning) {
    items.push(t.stalled ? { text: '⚠ MOTOR CALADO', status: 'danger' } : { text: 'Motor apagado', status: 'warn' })
    items.push(
      clutchPressed || t.gear === 'N'
        ? { text: clutchPressed ? 'Embrague pisado' : 'Punto muerto', status: 'ok' }
        : { text: 'Pisa el embrague a fondo', status: 'todo' },
    )
    items.push({ text: `Pulsa ${ctx.startLabel} para arrancar`, status: 'todo' })
    return items
  }

  items.push({ text: 'Motor encendido', status: 'ok' })

  if (t.limiterActive) items.push({ text: '⚠ REDLINE: suelta el acelerador o sube de marcha', status: 'danger' })

  if (stopped) {
    if (t.gear === 'N') {
      items.push(clutchPressed ? { text: 'Embrague pisado', status: 'ok' } : { text: 'Pisa el embrague a fondo', status: 'todo' })
      items.push({ text: 'Selecciona primera', status: clutchPressed ? 'todo' : 'info' })
      return items
    }

    if (t.gear === 1) items.push({ text: 'Primera seleccionada', status: 'ok' })
    else if (t.gear === 'R') items.push({ text: 'Marcha atrás seleccionada', status: 'ok' })
    else items.push({ text: `Estás en ${gearName}: para salir usa primera`, status: 'warn' })

    if (t.clutchEngagement < 0.01) {
      items.push({ text: 'Embrague pisado', status: 'ok' })
      items.push(
        t.accelerator < 0.08
          ? { text: 'Acelera ligeramente (15–25 %)', status: 'todo' }
          : t.accelerator > 0.45
            ? { text: 'Demasiado acelerador para salir', status: 'warn' }
            : { text: `Acelerador ${Math.round(t.accelerator * 100)} %`, status: 'ok' },
      )
      items.push({ text: 'Libera el embrague progresivamente', status: 'todo' })
    } else {
      if (isInFrictionZone(t.clutchPedal, cfg.clutchBitePoint))
        items.push({ text: '🔥 Punto de fricción: mantén el pedal y acelera suave', status: 'info' })
      else items.push({ text: 'Libera el embrague progresivamente', status: 'todo' })
      if (t.rpm < 900) items.push({ text: 'Las RPM bajan: más acelerador o pisa el embrague', status: 'warn' })
    }
    if (t.brake > 0.1 && t.clutchEngagement > 0.3) items.push({ text: '⚠ PISA EL EMBRAGUE', status: 'danger' })
    return items
  }

  // En movimiento
  const suggested = recommendedGear(t.speedKmh)
  if (t.gear === 'N') {
    items.push({ text: 'Punto muerto: el motor no empuja las ruedas', status: 'info' })
    if (Math.abs(t.speedKmh) > 5 && t.speedKmh > 0)
      items.push({ text: `Pisa el embrague y mete ${suggested}ª`, status: 'todo' })
    return items
  }

  items.push({ text: `Marcha: ${gearName}`, status: 'ok' })

  if (t.clutchEngagement < 0.05) {
    items.push({ text: 'Embrague pisado: el coche va por inercia', status: 'info' })
    if (typeof t.gear === 'number' && t.speedKmh > 0) {
      const target = Math.abs(drivetrainRpm(t.speedKmh, t.gear))
      if (target > 6000) items.push({ text: `En ${gearName} el motor iría a ${Math.round(target)} RPM: marcha demasiado corta`, status: 'warn' })
      else if (target < RPM_LOW_WARNING && t.brake < 0.1)
        items.push({ text: `En ${gearName} el motor iría muy bajo de vueltas`, status: 'warn' })
      else items.push({ text: 'Suelta el embrague progresivamente', status: 'todo' })
    }
    return items
  }

  if (t.clutchEngagement < 0.95) {
    items.push({ text: 'Soltando embrague…', status: 'info' })
    if (Math.abs(t.clutchSlipRpm) > 1200) items.push({ text: 'Gran diferencia de RPM: suelta más despacio', status: 'warn' })
    return items
  }

  if (t.rpm < RPM_LOW_WARNING) {
    items.push({ text: '⚠ PISA EL EMBRAGUE', status: 'danger' })
    return items
  }
  if (t.brake > 0.1 && t.rpm < 1300) items.push({ text: '⚠ PISA EL EMBRAGUE antes de detenerte', status: 'danger' })
  else if (t.rpm < RPM_LUGGING && typeof t.gear === 'number' && t.gear > 1)
    items.push({ text: `RPM bajas para ${gearName}: reduce a ${t.gear - 1}ª`, status: 'warn' })
  else if (t.rpm > UPSHIFT_HINT_RPM && typeof t.gear === 'number' && t.gear < 5 && t.accelerator > 0.15)
    items.push({ text: `Buen momento para cambiar a ${t.gear + 1}ª`, status: 'todo' })
  else items.push({ text: 'RPM en zona útil', status: 'ok' })

  return items
}
