import type { Gear } from '../simulation/types'

/** Clasificación interna (no se muestra tal cual al usuario). */
export type Quality = 'smooth' | 'acceptable' | 'rough' | 'bad'

export const QUALITY_SCORE: Record<Quality, number> = {
  smooth: 100,
  acceptable: 80,
  rough: 45,
  bad: 15,
}

export interface ShiftEvaluation {
  from: Gear
  to: Gear
  kind: 'upshift' | 'downshift'
  quality: Quality
  rpmBefore: number
  rpmAfter: number
  clutchReleaseTime: number
  /** Brusquedad máxima (m/s²). */
  jolt: number
  speedLoss: number
  noClutch: boolean
  stalled: boolean
  message: string
}

export interface LaunchEvaluation {
  gear: Gear
  quality: Quality
  timeToMove: number
  maxRpm: number
  minRpm: number
  frictionTime: number
  avgAccelerator: number
  jolt: number
  stalled: boolean
  message: string
}

export type FeedbackTone = 'info' | 'success' | 'warning' | 'danger'

export interface FeedbackMessage {
  id: number
  text: string
  tone: FeedbackTone
  time: number
}

export type AssistantStatus = 'ok' | 'todo' | 'warn' | 'danger' | 'info'

export interface AssistantItem {
  text: string
  status: AssistantStatus
}

/** Sesión de entrenamiento (sección 74) + métricas educativas. */
export interface DrivingSession {
  id: string
  startTime: number
  duration: number
  mode: 'free' | 'exercise'
  exerciseId?: string
  stalls: number
  gearChanges: number
  smoothChanges: number
  roughChanges: number
  hardBrakes: number
  launches: number
  maxSpeed: number
  maxRPM: number
  distanceMeters: number
  /** 0–100 o null si aún no hay datos. */
  clutchControl: number | null
  rpmControl: number | null
  smoothness: number | null
}
