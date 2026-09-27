import { useEffect, useRef } from 'react'
import { simulator } from '../../hooks/useSimulation'
import { drawRoad } from './roadRenderer'
import './RoadView.css'

const PITCH_PER_MS2 = 0.012
const MAX_PITCH = 0.07
const PITCH_TAU = 0.12

/**
 * Vista lateral de la ruta. Dibuja en canvas con su propio requestAnimationFrame,
 * leyendo la telemetría directamente del motor de simulación (sin renders de React).
 */
export function RoadView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let raf = 0
    let last = 0
    let pitch = 0
    let width = 0
    let height = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
      last = now
      const t = simulator.engine.getTelemetry()
      // Cabeceo suavizado: al frenar baja el morro, al acelerar sube; los tirones se notan.
      const target = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, -t.accelerationMs2 * PITCH_PER_MS2))
      pitch += (target - pitch) * (1 - Math.exp(-dt / PITCH_TAU))
      if (width > 0 && height > 0) {
        drawRoad(ctx, width, height, {
          positionMeters: t.positionMeters,
          speedKmh: t.speedKmh,
          pitch,
          brake: t.brake,
          gear: t.gear,
          engineRunning: t.engineRunning,
        })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="road-canvas" aria-label="Vista de la ruta con el coche en movimiento" role="img" />
}
