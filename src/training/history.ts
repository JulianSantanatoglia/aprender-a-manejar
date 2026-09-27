import { loadJSON, saveJSON, STORAGE_KEYS } from '../core/storage'
import type { DrivingSession } from './types'

const MAX_SESSIONS = 100
/** Sesiones más cortas no se guardan (abrir y cerrar la app). */
export const MIN_SESSION_SECONDS = 10

export function loadHistory(): DrivingSession[] {
  const list = loadJSON<DrivingSession[]>(STORAGE_KEYS.history, [])
  return Array.isArray(list) ? list : []
}

export function saveSession(session: DrivingSession): DrivingSession[] {
  const list = loadHistory().filter((s) => s.id !== session.id)
  const next = [session, ...list].slice(0, MAX_SESSIONS)
  saveJSON(STORAGE_KEYS.history, next)
  return next
}

export function clearHistory() {
  saveJSON(STORAGE_KEYS.history, [])
}

export interface ExerciseRecord {
  completedAt: number
  bestTime: number
  attempts: number
}

export type ExerciseRecords = Record<string, ExerciseRecord>

export function loadExerciseRecords(): ExerciseRecords {
  return loadJSON<ExerciseRecords>(STORAGE_KEYS.exercises, {})
}

export function recordExercise(id: string, time: number, attempts: number): ExerciseRecords {
  const all = loadExerciseRecords()
  const prev = all[id]
  all[id] = {
    completedAt: Date.now(),
    bestTime: prev ? Math.min(prev.bestTime, time) : time,
    attempts: (prev?.attempts ?? 0) + attempts,
  }
  saveJSON(STORAGE_KEYS.exercises, all)
  return all
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
