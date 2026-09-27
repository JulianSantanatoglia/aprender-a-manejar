import { AudioSystem } from '../audio/AudioSystem'
import { defaultAxisCalibration } from '../input/calibration'
import { DEFAULT_GAMEPAD_BINDINGS, DEFAULT_KEYBOARD_BINDINGS, isDualSense } from '../input/GamepadMapping'
import { InputManager, type DeviceEvent } from '../input/InputManager'
import type {
  ActionId,
  Calibration,
  DeviceKind,
  DevicePreference,
  GamepadBinding,
  GamepadBindings,
  GamepadDiagnostics,
  InputState,
  KeyboardBindings,
} from '../input/types'
import { MAX_FRAME_DT, UI_UPDATE_HZ } from '../simulation/constants'
import { SimulationEngine } from '../simulation/engine'
import type { SimulationEvent, VehicleConfig, VehicleTelemetry } from '../simulation/types'
import { analyzeDriving } from '../training/assistant'
import { EXERCISES, ExerciseTracker, getExercise, type ExerciseStatus } from '../training/exercises'
import { FeedbackBus, LiveCoach } from '../training/feedback'
import {
  loadExerciseRecords,
  loadHistory,
  MIN_SESSION_SECONDS,
  recordExercise,
  saveSession,
  clearHistory as clearStoredHistory,
  type ExerciseRecords,
} from '../training/history'
import { LaunchAnalyzer } from '../training/LaunchAnalyzer'
import { SessionTracker } from '../training/SessionTracker'
import { ShiftAnalyzer } from '../training/ShiftAnalyzer'
import type {
  AssistantItem,
  DrivingSession,
  FeedbackMessage,
  FeedbackTone,
  LaunchEvaluation,
  Quality,
  ShiftEvaluation,
} from '../training/types'
import {
  loadCalibration,
  loadGamepadBindings,
  loadKeyboardBindings,
  loadSettings,
  saveCalibration,
  saveGamepadBindings,
  saveKeyboardBindings,
  saveSettings,
  type AppSettings,
} from './settings'

export type View = 'drive' | 'exercises' | 'controller' | 'settings' | 'history'
export type DriveMode = { kind: 'free' } | { kind: 'exercise'; id: string }

export interface AppSnapshot {
  view: View
  paused: boolean
  mode: DriveMode
  summary: DrivingSession | null
  input: InputState
  activeDevice: DeviceKind
  gamepad: GamepadDiagnostics
  vehicle: VehicleTelemetry
  config: VehicleConfig
  assistant: AssistantItem[]
  feedback: FeedbackMessage[]
  notices: FeedbackMessage[]
  session: DrivingSession
  exercise: ExerciseStatus | null
  exerciseRecords: ExerciseRecords
  lastShift: ShiftEvaluation | null
  lastLaunch: LaunchEvaluation | null
  history: DrivingSession[]
  settings: AppSettings
  calibration: Calibration
  gamepadBindings: GamepadBindings
  keyboardBindings: KeyboardBindings
  capturing: { device: DeviceKind; action: ActionId } | null
  audioUnlocked: boolean
}

const VIEWS: readonly View[] = ['drive', 'exercises', 'controller', 'settings', 'history']

function viewFromHash(): View {
  if (typeof location === 'undefined') return 'drive'
  const hash = location.hash.slice(1) as View
  return VIEWS.includes(hash) ? hash : 'drive'
}

const QUALITY_TONE: Record<Quality, FeedbackTone> = {
  smooth: 'success',
  acceptable: 'info',
  rough: 'warning',
  bad: 'danger',
}

/**
 * Orquesta el bucle principal (requestAnimationFrame):
 *   INPUT → INPUT STATE → SIMULACIÓN → ESTADO DEL VEHÍCULO → UI / AUDIO / FEEDBACK
 * La física vive aquí, fuera de React. React solo recibe snapshots a UI_UPDATE_HZ.
 */
export class Simulator {
  readonly input = new InputManager()
  readonly engine: SimulationEngine
  readonly audio = new AudioSystem()

  private settings: AppSettings
  private calibration: Calibration
  private view: View = viewFromHash()
  private paused = false
  private mode: DriveMode = { kind: 'free' }
  private session = new SessionTracker('free')
  private sessionSaved = false
  private summary: DrivingSession | null = null
  private exercise: ExerciseTracker | null = null
  private exerciseRecords: ExerciseRecords = loadExerciseRecords()
  private history: DrivingSession[] = loadHistory()
  private shiftAnalyzer = new ShiftAnalyzer()
  private launchAnalyzer = new LaunchAnalyzer()
  private coach = new LiveCoach()
  private feedback = new FeedbackBus()
  private notices = new FeedbackBus()
  private lastShift: ShiftEvaluation | null = null
  private lastLaunch: LaunchEvaluation | null = null
  private capturing: AppSnapshot['capturing'] = null
  private gamepadSeen = false

  private listeners = new Set<() => void>()
  private snapshot: AppSnapshot
  private rafId = 0
  private running = false
  private lastFrame = 0
  private uiAccumulator = 0
  private clock = 0
  private highRpmCooldown = 0
  private unsubscribeDevices: (() => void) | null = null

  constructor() {
    this.settings = loadSettings()
    this.calibration = loadCalibration()
    this.engine = new SimulationEngine(this.settings.vehicle)
    this.input.gamepad.setBindings(loadGamepadBindings())
    this.input.keyboard.setBindings(loadKeyboardBindings())
    this.input.gamepad.setCalibration(this.calibration)
    this.applySettings()
    this.input.reset()
    this.snapshot = this.buildSnapshot()
  }

  // ─── Suscripción para React (useSyncExternalStore) ──────────────────────
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): AppSnapshot => this.snapshot

  private emit() {
    this.snapshot = this.buildSnapshot()
    this.listeners.forEach((l) => l())
  }

  // ─── Ciclo de vida ─────────────────────────────────────────────────────
  start() {
    if (this.running) return
    this.running = true
    this.input.attach()
    this.unsubscribeDevices = this.input.onDeviceEvent(this.onDeviceEvent)
    window.addEventListener('beforeunload', this.persistSession)
    this.lastFrame = 0
    this.rafId = requestAnimationFrame(this.frame)
  }

  stop() {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.rafId)
    this.input.detach()
    this.unsubscribeDevices?.()
    window.removeEventListener('beforeunload', this.persistSession)
  }

  private frame = (now: number) => {
    if (!this.running) return
    const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, MAX_FRAME_DT) : 0
    this.lastFrame = now
    this.clock += dt

    this.input.update(dt)
    const inp = this.input.getState()
    let force = false

    if (this.view === 'drive' && !this.summary && !this.capturing) {
      let skipCommands = false
      if (inp.pause) {
        this.setPaused(!this.paused)
        skipCommands = true
        force = true
      } else if (this.paused && inp.start) {
        this.setPaused(false)
        skipCommands = true
        force = true
      }
      if (inp.restart) {
        this.restart()
        skipCommands = true
        force = true
      }
      if (!this.paused) this.step(dt, inp, skipCommands)
      else this.audio.mute()
    } else {
      this.audio.mute()
    }

    if (this.feedback.prune(this.clock)) force = true
    if (this.notices.prune(this.clock)) force = true

    this.uiAccumulator += dt
    if (force || this.uiAccumulator >= 1 / UI_UPDATE_HZ) {
      this.uiAccumulator = 0
      this.emit()
    }
    this.rafId = requestAnimationFrame(this.frame)
  }

  // ─── Paso de simulación ────────────────────────────────────────────────
  private step(dt: number, inp: InputState, skipCommands: boolean) {
    const distanceBefore = this.engine.getTelemetry().distanceMeters
    this.engine.update(
      dt,
      { clutch: inp.clutch, accelerator: inp.accelerator, brake: inp.brake },
      skipCommands
        ? undefined
        : { gearUp: inp.gearUp, gearDown: inp.gearDown, selectGear: inp.selectedGear, start: inp.start },
    )
    const t = this.engine.getTelemetry()
    const time = this.engine.time
    const cfg = this.engine.getConfig()

    for (const ev of this.engine.drainEvents()) this.handleEvent(ev, t, time)

    const shift = this.shiftAnalyzer.update(t, time, cfg.redlineRpm)
    if (shift) this.onShiftEvaluated(shift)
    const launch = this.launchAnalyzer.update(t, time, dt)
    if (launch) this.onLaunchEvaluated(launch)

    const { hardBrake } = this.coach.update(t, dt, this.clock, this.feedback, this.launchAnalyzer.isActive(), cfg.clutchBitePoint)
    if (hardBrake) {
      this.session.onHardBrake()
      this.audio.play('brake')
    }

    this.session.update(t, dt, t.distanceMeters - distanceBefore)
    if (this.exercise?.onFrame(t, dt)) this.onExerciseFinished()

    this.audio.updateEngine(t.rpm, t.throttle, t.engineRunning, cfg.redlineRpm)
    if (t.engineRunning && t.rpm > cfg.redlineRpm - 500 && this.clock > this.highRpmCooldown) {
      this.audio.play('highRpm')
      this.highRpmCooldown = this.clock + 0.7
    }
  }

  private handleEvent(ev: SimulationEvent, t: VehicleTelemetry, time: number) {
    switch (ev.type) {
      case 'gearChange': {
        this.session.onGearChange()
        this.shiftAnalyzer.onGearChange(ev.event, t, time)
        if (ev.event.noClutch) {
          this.feedback.push('⚠ Cambio sin embrague.', 'danger', this.clock, 'no-clutch', 1)
          this.audio.play('grind')
        } else {
          this.audio.play('shift')
        }
        break
      }
      case 'gearRejected':
        this.feedback.push(ev.reason, 'warning', this.clock, `rejected-${ev.to}`, 1.5)
        this.audio.play('alert')
        break
      case 'stall': {
        this.session.onStall()
        const s = this.shiftAnalyzer.onStall(t)
        if (s) this.onShiftEvaluated(s)
        const l = this.launchAnalyzer.onStall()
        if (l) this.onLaunchEvaluated(l)
        this.feedback.push('⚠ MOTOR CALADO — Pisa el embrague y vuelve a arrancar.', 'danger', this.clock, 'stall', 1)
        this.audio.play('stall')
        if (this.exercise?.onStall(t)) this.onExerciseFinished()
        break
      }
      case 'engineStart':
        this.feedback.push('Motor arrancado.', 'success', this.clock, 'start', 1)
        this.audio.play('starter')
        break
      case 'startFailed':
        this.feedback.push(ev.reason, 'warning', this.clock, 'start-failed', 1.5)
        this.audio.play('alert')
        break
      case 'reset':
        break
    }
  }

  private onShiftEvaluated(e: ShiftEvaluation) {
    this.lastShift = e
    this.session.onShift(e)
    if (!e.stalled) this.feedback.push(e.message, QUALITY_TONE[e.quality], this.clock)
    if (this.exercise?.onShift(e)) this.onExerciseFinished()
  }

  private onLaunchEvaluated(e: LaunchEvaluation) {
    this.lastLaunch = e
    this.session.onLaunch(e)
    this.feedback.push(e.message, e.stalled ? 'danger' : QUALITY_TONE[e.quality], this.clock)
    if (this.exercise?.onLaunch(e)) this.onExerciseFinished()
  }

  private onExerciseFinished() {
    const status = this.exercise?.get()
    if (!status) return
    if (status.state === 'success') {
      this.audio.play('success')
      this.exerciseRecords = recordExercise(status.id, status.elapsed, status.attempts)
    }
  }

  private onDeviceEvent = (e: DeviceEvent) => {
    const name = isDualSense(e.id) ? 'DualSense' : 'Mando'
    if (e.type === 'gamepadConnected') {
      this.notices.push(this.gamepadSeen ? `✓ ${name} conectado` : `🎮 ${name} conectado`, 'success', this.clock)
      this.gamepadSeen = true
    } else {
      this.notices.push(
        e.fallback ? `⚠ ${name} desconectado. Cambiando a teclado.` : `⚠ ${name} desconectado.`,
        'warning',
        this.clock,
      )
    }
    this.emit()
  }

  // ─── Acciones de la UI ─────────────────────────────────────────────────
  setView(view: View) {
    this.view = view
    try {
      history.replaceState(null, '', view === 'drive' ? location.pathname : `#${view}`)
    } catch {
      // Entornos sin history (tests).
    }
    if (view !== 'drive') this.paused = false
    this.emit()
  }

  setPaused(paused: boolean) {
    this.paused = paused
    this.emit()
  }

  /** Reinicio (SHARE): motor en marcha, 800 RPM, N, parado. */
  restart() {
    this.resetDrive()
    this.exercise?.retry()
    this.emit()
  }

  private resetDrive() {
    this.engine.reset(this.exercise ? this.exercise.def.initial : {})
    this.engine.drainEvents()
    this.input.reset()
    this.shiftAnalyzer.cancel()
    this.launchAnalyzer.cancel()
    this.coach.reset()
    this.feedback.clear()
    this.paused = false
  }

  startFreePractice() {
    this.finishSession(false)
    this.mode = { kind: 'free' }
    this.exercise = null
    this.session = new SessionTracker('free')
    this.sessionSaved = false
    this.resetDrive()
    this.setView('drive')
  }

  startExercise(id: string) {
    const def = getExercise(id)
    if (!def) return
    this.finishSession(false)
    this.mode = { kind: 'exercise', id }
    this.exercise = new ExerciseTracker(def)
    this.session = new SessionTracker('exercise', id)
    this.sessionSaved = false
    this.resetDrive()
    this.setView('drive')
  }

  nextExercise() {
    if (this.mode.kind !== 'exercise') return
    const current = this.mode.id
    const i = EXERCISES.findIndex((e) => e.id === current)
    const next = EXERCISES[i + 1]
    if (next) this.startExercise(next.id)
    else this.setView('exercises')
  }

  /** Termina la sesión y muestra el resumen. */
  endSession() {
    this.summary = this.finishSession(true)
    this.paused = false
    this.emit()
  }

  dismissSummary() {
    this.summary = null
    this.session = new SessionTracker(this.mode.kind, this.mode.kind === 'exercise' ? this.mode.id : undefined)
    this.sessionSaved = false
    this.restart()
  }

  private finishSession(returnSummary: boolean): DrivingSession | null {
    const s = this.session.get()
    if (!this.sessionSaved && s.duration >= MIN_SESSION_SECONDS) {
      this.history = saveSession(s)
      this.sessionSaved = true
    }
    return returnSummary ? s : null
  }

  private persistSession = () => {
    this.finishSession(false)
  }

  clearHistory() {
    clearStoredHistory()
    this.history = []
    this.emit()
  }

  unlockAudio() {
    this.audio.unlock()
  }

  // ─── Configuración ─────────────────────────────────────────────────────
  updateSettings(patch: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...patch }
    saveSettings(this.settings)
    this.applySettings()
    this.emit()
  }

  private applySettings() {
    const s = this.settings
    this.input.setPreference(s.device)
    this.input.gamepad.setSettings(s.input)
    this.input.keyboard.setSettings(s.input)
    this.engine.setConfig(s.vehicle)
    this.audio.setEnabled(s.audio.enabled)
    this.audio.setVolume(s.audio.volume)
  }

  setDevicePreference(device: DevicePreference) {
    this.updateSettings({ device })
  }

  setCalibration(c: Calibration) {
    this.calibration = c
    this.input.gamepad.setCalibration(c)
    saveCalibration(c)
    this.emit()
  }

  setGamepadBinding(action: ActionId, binding: GamepadBinding) {
    const next = { ...this.input.gamepad.getBindings(), [action]: binding }
    this.input.gamepad.setBindings(next)
    saveGamepadBindings(next)
    // Un eje necesita otra calibración por defecto (-1…1) que un gatillo (0…1).
    if (action === 'clutch' || action === 'accelerator') {
      this.setCalibration({ ...this.calibration, [action]: defaultAxisCalibration(binding), calibrated: false })
    }
    this.emit()
  }

  setKeyboardBinding(action: ActionId, code: string) {
    const next = { ...this.input.keyboard.getBindings(), [action]: [code] }
    this.input.keyboard.setBindings(next)
    saveKeyboardBindings(next)
    this.emit()
  }

  resetBindings() {
    this.input.gamepad.setBindings(DEFAULT_GAMEPAD_BINDINGS)
    this.input.keyboard.setBindings(DEFAULT_KEYBOARD_BINDINGS)
    saveGamepadBindings(DEFAULT_GAMEPAD_BINDINGS)
    saveKeyboardBindings(DEFAULT_KEYBOARD_BINDINGS)
    this.setCalibration({
      ...this.calibration,
      clutch: defaultAxisCalibration(DEFAULT_GAMEPAD_BINDINGS.clutch),
      accelerator: defaultAxisCalibration(DEFAULT_GAMEPAD_BINDINGS.accelerator),
    })
  }

  captureBinding(device: DeviceKind, action: ActionId) {
    this.cancelCapture()
    this.capturing = { device, action }
    if (device === 'gamepad') {
      this.input.gamepad.captureNext((binding) => {
        this.capturing = null
        this.setGamepadBinding(action, binding)
      })
    } else {
      this.input.keyboard.captureNext((code) => {
        this.capturing = null
        if (code) this.setKeyboardBinding(action, code)
        else this.emit()
      })
    }
    this.emit()
  }

  cancelCapture() {
    this.input.gamepad.cancelCapture()
    this.input.keyboard.cancelCapture()
    if (this.capturing) {
      this.capturing = null
      this.emit()
    }
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────
  private buildSnapshot(): AppSnapshot {
    const vehicle = { ...this.engine.getTelemetry() }
    const config = this.engine.getConfig()
    const activeDevice = this.input.getActiveKind()
    return {
      view: this.view,
      paused: this.paused,
      mode: this.mode,
      summary: this.summary,
      input: { ...this.input.getState() },
      activeDevice,
      gamepad: this.input.gamepad.getDiagnostics(),
      vehicle,
      config,
      assistant: this.settings.assistant
        ? analyzeDriving(vehicle, config, { startLabel: activeDevice === 'gamepad' ? '✕' : 'ESPACIO' })
        : [],
      feedback: this.feedback.list(),
      notices: this.notices.list(),
      session: this.session.get(),
      exercise: this.exercise ? this.exercise.get() : null,
      exerciseRecords: this.exerciseRecords,
      lastShift: this.lastShift,
      lastLaunch: this.lastLaunch,
      history: this.history,
      settings: this.settings,
      calibration: this.calibration,
      gamepadBindings: this.input.gamepad.getBindings(),
      keyboardBindings: this.input.keyboard.getBindings(),
      capturing: this.capturing,
      audioUnlocked: this.audio.isUnlocked(),
    }
  }
}
