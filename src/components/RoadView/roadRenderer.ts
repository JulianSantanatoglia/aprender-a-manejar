import { WHEEL_RADIUS_M } from '../../simulation/constants'
import type { Gear } from '../../simulation/types'

/** Lo que necesita el dibujo de cada frame (subconjunto de la telemetría). */
export interface RoadFrame {
  positionMeters: number
  speedKmh: number
  /** Cabeceo de la carrocería, rad (positivo = morro abajo). */
  pitch: number
  brake: number
  gear: Gear
  engineRunning: boolean
}

/** Longitud de la ruta; al completarla se empieza otra vuelta. */
export const ROUTE_LENGTH_M = 1000
const CAR_SCREEN_X = 0.32
const DASH_EVERY_M = 6
const DASH_LENGTH_M = 3
const POST_EVERY_M = 10
const LABEL_EVERY_M = 50
const TREE_EVERY_M = 7
const LAMP_EVERY_M = 30

const C = {
  skyTop: '#070a0f',
  skyBottom: '#101826',
  hillsFar: '#16243a',
  hillsNear: '#1c2d44',
  verge: '#141c16',
  asphalt: '#1b2029',
  asphaltEdge: '#2a313d',
  dash: '#c9d2e0',
  post: '#5a6474',
  postLabel: '#8d97a8',
  tree: '#1f4030',
  treeFar: '#18301f',
  lamp: '#3a4658',
  lampLight: 'rgba(253, 230, 138, 0.9)',
  trunk: '#2a2320',
  body: '#4cc2ff',
  bodyShade: '#2b8fd0',
  glass: '#0d1520',
  tire: '#0b0d10',
  rim: '#8d97a8',
  headlight: '#fde68a',
  tail: '#7f1d1d',
  tailOn: '#ff4d4d',
  reverse: '#f8fafc',
  text: '#e8ecf2',
  muted: '#8d97a8',
  accent: '#4cc2ff',
}

/** Relieve determinista (mismas colinas en el mismo sitio de la ruta). */
function hill(x: number, seed: number): number {
  return Math.sin(x * 0.011 + seed) * 0.5 + Math.sin(x * 0.027 + seed * 2.3) * 0.3 + Math.sin(x * 0.061 + seed * 0.7) * 0.2
}

/** Pseudoaleatorio estable por índice (variedad de árboles sin parpadeo). */
function rand(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function drawRoad(ctx: CanvasRenderingContext2D, w: number, h: number, f: RoadFrame) {
  // Píxeles por metro: según el alto, sin que el coche quede diminuto en franjas muy anchas.
  const ppm = Math.max(h / 6.2, Math.min(w / 34, h / 4.2))
  const carX = w * CAR_SCREEN_X
  const roadTop = h * 0.7
  const groundY = h * 0.84 // línea de contacto de las ruedas
  const pos = f.positionMeters
  /** Metros del mundo → x en pantalla con un factor de paralaje. */
  const sx = (m: number, parallax = 1) => carX + (m - pos * parallax) * ppm
  const visible = (parallax: number) => {
    const from = pos * parallax - carX / ppm - 5
    return { from, to: from + w / ppm + 10 }
  }

  // Cielo
  const sky = ctx.createLinearGradient(0, 0, 0, roadTop)
  sky.addColorStop(0, C.skyTop)
  sky.addColorStop(1, C.skyBottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // Colinas con paralaje (lejanas se mueven más despacio)
  const drawHills = (parallax: number, base: number, amp: number, seed: number, color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, roadTop)
    for (let x = 0; x <= w + 8; x += 8) {
      const worldM = (x - carX) / ppm + pos * parallax
      ctx.lineTo(x, base - hill(worldM * 4, seed) * amp)
    }
    ctx.lineTo(w, roadTop)
    ctx.closePath()
    ctx.fill()
  }
  drawHills(0.08, roadTop - h * 0.28, h * 0.12, 1.3, C.hillsFar)
  drawHills(0.2, roadTop - h * 0.14, h * 0.08, 4.1, C.hillsNear)

  // Árboles (plano medio)
  const trees = visible(0.55)
  for (let i = Math.floor(trees.from / TREE_EVERY_M); i * TREE_EVERY_M < trees.to; i++) {
    const r = rand(i)
    if (r < 0.2) continue
    const x = sx(i * TREE_EVERY_M + r * 5, 0.55)
    const size = h * (0.1 + r * 0.08)
    ctx.fillStyle = C.trunk
    ctx.fillRect(x - size * 0.06, roadTop - size * 0.55, size * 0.12, size * 0.55)
    ctx.fillStyle = r > 0.6 ? C.tree : C.treeFar
    ctx.beginPath()
    ctx.arc(x, roadTop - size * 0.75, size * 0.42, 0, Math.PI * 2)
    ctx.fill()
  }

  // Farolas (mismo plano que la carretera): referencia rápida de velocidad
  const lamps = visible(1)
  for (let i = Math.floor(lamps.from / LAMP_EVERY_M); i * LAMP_EVERY_M < lamps.to; i++) {
    const x = sx(i * LAMP_EVERY_M + 5)
    const top = roadTop - h * 0.42
    ctx.fillStyle = C.lamp
    ctx.fillRect(x - 2, top, 4, roadTop - top)
    ctx.fillRect(x - 2, top, h * 0.09, 3)
    ctx.fillStyle = C.lampLight
    ctx.beginPath()
    ctx.arc(x + h * 0.085, top + 5, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // Arcén y asfalto
  ctx.fillStyle = C.verge
  ctx.fillRect(0, roadTop - h * 0.03, w, h * 0.03)
  ctx.fillStyle = C.asphalt
  ctx.fillRect(0, roadTop, w, h - roadTop)
  ctx.fillStyle = C.asphaltEdge
  ctx.fillRect(0, roadTop, w, 2)

  // Postes kilométricos cada 10 m (etiqueta cada 50 m): referencia de distancia
  const posts = visible(1)
  ctx.font = `600 ${Math.max(10, h * 0.065)}px Inter, 'Segoe UI', system-ui, sans-serif`
  ctx.textAlign = 'center'
  for (let i = Math.floor(posts.from / POST_EVERY_M); i * POST_EVERY_M < posts.to; i++) {
    const m = i * POST_EVERY_M
    const x = sx(m)
    const labeled = m % LABEL_EVERY_M === 0
    ctx.fillStyle = C.post
    const postH = labeled ? h * 0.13 : h * 0.07
    ctx.fillRect(x - 1.5, roadTop - postH, 3, postH)
    if (labeled) {
      const routeM = ((m % ROUTE_LENGTH_M) + ROUTE_LENGTH_M) % ROUTE_LENGTH_M
      ctx.fillStyle = routeM === 0 ? C.accent : C.postLabel
      ctx.fillText(routeM === 0 ? 'SALIDA' : `${routeM} m`, x, roadTop - postH - 5)
    }
  }

  // Línea discontinua (se desplaza a la velocidad real del coche)
  const laneY = groundY + (h - groundY) * 0.45
  ctx.fillStyle = C.dash
  for (let i = Math.floor(posts.from / DASH_EVERY_M); i * DASH_EVERY_M < posts.to; i++) {
    ctx.fillRect(sx(i * DASH_EVERY_M), laneY, DASH_LENGTH_M * ppm, Math.max(2, h * 0.015))
  }

  drawCar(ctx, carX, groundY, ppm, f)
  drawOverlay(ctx, w, h, f)
}

function drawCar(ctx: CanvasRenderingContext2D, cx: number, groundY: number, ppm: number, f: RoadFrame) {
  const m = (v: number) => v * ppm
  const wheelR = m(WHEEL_RADIUS_M)
  const wheelBase = 1.25
  const axleY = groundY - wheelR

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.ellipse(cx, groundY + 2, m(2.2), m(0.12), 0, 0, Math.PI * 2)
  ctx.fill()

  // Carrocería (cabecea con la aceleración: los tirones se ven)
  ctx.save()
  ctx.translate(cx, axleY)
  ctx.rotate(f.pitch)
  const y = (v: number) => -m(v) // metros hacia arriba desde el eje

  ctx.fillStyle = C.body
  ctx.beginPath()
  ctx.moveTo(m(-2.05), y(0.05))
  ctx.lineTo(m(-2.1), y(0.55))
  ctx.lineTo(m(-1.75), y(0.62))
  ctx.lineTo(m(-1.25), y(1.12))
  ctx.lineTo(m(0.55), y(1.12))
  ctx.lineTo(m(1.25), y(0.62))
  ctx.lineTo(m(2.0), y(0.5))
  ctx.lineTo(m(2.08), y(0.05))
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = C.bodyShade
  ctx.fillRect(m(-2.05), y(0.2), m(4.13), m(0.15))

  // Ventanillas
  ctx.fillStyle = C.glass
  ctx.beginPath()
  ctx.moveTo(m(-1.6), y(0.66))
  ctx.lineTo(m(-1.18), y(1.04))
  ctx.lineTo(m(-0.35), y(1.04))
  ctx.lineTo(m(-0.35), y(0.66))
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(m(-0.22), y(0.66))
  ctx.lineTo(m(-0.22), y(1.04))
  ctx.lineTo(m(0.5), y(1.04))
  ctx.lineTo(m(1.05), y(0.66))
  ctx.closePath()
  ctx.fill()

  // Luces: delantera, freno (se enciende al frenar), marcha atrás
  ctx.fillStyle = f.engineRunning ? C.headlight : '#5b5234'
  ctx.fillRect(m(1.9), y(0.48), m(0.16), m(0.12))
  ctx.fillStyle = f.brake > 0.05 ? C.tailOn : C.tail
  if (f.brake > 0.05) {
    ctx.shadowColor = C.tailOn
    ctx.shadowBlur = m(0.6)
  }
  ctx.fillRect(m(-2.12), y(0.58), m(0.18), m(0.22))
  ctx.shadowBlur = 0
  if (f.gear === 'R') {
    ctx.fillStyle = C.reverse
    ctx.fillRect(m(-2.08), y(0.32), m(0.1), m(0.08))
  }
  ctx.restore()

  // Ruedas: el giro corresponde a la distancia recorrida (v = ω · r)
  const angle = f.positionMeters / WHEEL_RADIUS_M
  for (const wx of [-wheelBase, wheelBase]) {
    const x = cx + m(wx)
    ctx.fillStyle = C.tire
    ctx.beginPath()
    ctx.arc(x, axleY, wheelR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = C.rim
    ctx.lineWidth = Math.max(1.5, wheelR * 0.12)
    ctx.beginPath()
    ctx.arc(x, axleY, wheelR * 0.62, 0, Math.PI * 2)
    ctx.stroke()
    for (let k = 0; k < 5; k++) {
      const a = angle + (k * Math.PI * 2) / 5
      ctx.beginPath()
      ctx.moveTo(x, axleY)
      ctx.lineTo(x + Math.cos(a) * wheelR * 0.6, axleY + Math.sin(a) * wheelR * 0.6)
      ctx.stroke()
    }
  }
}

function drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, f: RoadFrame) {
  const pad = Math.max(10, h * 0.07)
  const shown = Math.abs(f.speedKmh) < 0.5 ? 0 : Math.round(f.speedKmh)

  ctx.textAlign = 'left'
  ctx.fillStyle = C.text
  ctx.font = `800 ${Math.max(26, h * 0.2)}px Inter, 'Segoe UI', system-ui, sans-serif`
  const numSize = Math.max(26, h * 0.2)
  ctx.fillText(String(shown), pad, pad + numSize * 0.8)
  const numW = ctx.measureText(String(shown)).width
  ctx.fillStyle = C.muted
  ctx.font = `600 ${Math.max(12, h * 0.075)}px Inter, 'Segoe UI', system-ui, sans-serif`
  ctx.fillText('km/h', pad + numW + 6, pad + numSize * 0.8)

  // Progreso de la ruta
  const lap = Math.floor(f.positionMeters / ROUTE_LENGTH_M) + 1
  const inRoute = ((f.positionMeters % ROUTE_LENGTH_M) + ROUTE_LENGTH_M) % ROUTE_LENGTH_M
  const barW = Math.min(w * 0.34, 320)
  const bx = w - pad - barW
  const by = pad + 4
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(bx, by, barW, 6)
  ctx.fillStyle = C.accent
  ctx.fillRect(bx, by, barW * (inRoute / ROUTE_LENGTH_M), 6)
  ctx.textAlign = 'right'
  ctx.fillStyle = C.muted
  ctx.font = `600 ${Math.max(12, h * 0.065)}px Inter, 'Segoe UI', system-ui, sans-serif`
  ctx.fillText(`Ruta ${Math.round(inRoute)} / ${ROUTE_LENGTH_M} m${lap > 1 ? ` · vuelta ${lap}` : ''}`, w - pad, by + 6 + h * 0.09)
}
