# 🚗 Simulador de conducción manual

Herramienta de entrenamiento para practicar la coordinación **embrague + acelerador + RPM + marcha** de un coche con caja manual, usando un **DualSense de PS5** (L2 = embrague, R2 = acelerador) o el teclado.

No es un videojuego: los gráficos son secundarios. Lo importante es que la física sea coherente y que el feedback enseñe.

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests (Vitest)
npm run build      # build de producción
```

1. Conecta el DualSense por **USB-C** (Bluetooth también funciona) y **pulsa cualquier botón** con la página abierta: los navegadores no exponen el mando hasta entonces.
2. Pestaña **Mando** → comprueba que L2/R2 van de 0 % a 100 % y pulsa **Empezar calibración**.
3. Pestaña **Conducir**: el motor arranca en ralentí, en N y con el embrague pisado.

Navegadores recomendados: Chrome o Edge. Firefox funciona si su Gamepad API expone los gatillos; si el mapeo no es estándar, la pantalla **Mando** lo avisa y los controles se pueden reasignar en **Configuración**.

## Controles

| DualSense | Teclado | Acción |
| --- | --- | --- |
| L2 (analógico) | A (progresivo) | Embrague |
| R2 (analógico) | D (progresivo) | Acelerador |
| L1 (con rampa) | S (progresivo) | Freno |
| D-Pad ↑ / ↓ | ↑ / ↓ | Subir / bajar marcha (secuencial) |
| — | Num 1–5 (o 1–5) | Seleccionar marcha directamente |
| △ | Num 5 | 5ª |
| ○ | Num 6 | Marcha atrás (solo parado y con embrague pisado) |
| ✕ | Num 0 | Neutral · con el motor parado, **arranque** |
| — | Espacio | Arranque (embrague pisado o en N) |
| OPTIONS | Esc | Pausa |
| SHARE | R | Reinicio |
| — | F2 | Modo debug |

Todo se puede reasignar en **Configuración → Controles** (clic en la asignación y pulsa el control nuevo). Las asignaciones, calibración, ajustes, historial y ejercicios superados se guardan en `localStorage`.

Con teclado, los pedales suben mientras mantienes la tecla y bajan al soltarla (dependiente de `deltaTime`, no de los FPS). El embrague baja despacio para que dé tiempo a encontrar el punto de fricción; la velocidad se ajusta en **Configuración → Sensibilidad**.

## Qué incluye

- **Conducir / Práctica libre**: tacómetro con zonas (ralentí, útil, alta, redline), velocidad, marcha, pedales con zona de fricción, palanca H virtual, asistente paso a paso y avisos (`⚠ MOTOR CALADO`, `⚠ PISA EL EMBRAGUE`, `⚠ REDLINE`).
- **Evaluación** de cada salida (tiempo en fricción, RPM mín./máx., gas medio, tirón) y de cada cambio (RPM antes/después, tiempo de embrague, brusquedad, pérdida de velocidad), clasificadas internamente como `smooth / acceptable / rough / bad` y mostradas como consejos.
- **Ejercicios**: salida 0→20 km/h, 1ª→2ª, 2ª→3ª, reducción 3ª→2ª, frenar y detenerse, marcha atrás.
- **Métricas educativas** por sesión (control del embrague, control de RPM, suavidad) e **historial**.
- **Mando**: diagnóstico en tiempo real (gatillos en bruto y procesados, botones, ejes) y asistente de calibración.
- **Configuración**: dispositivo, reasignación, deadzone/smoothing, audio y parámetros avanzados del vehículo.
- **Audio** sintetizado con Web Audio (motor según RPM y carga, cambio, rascado, calado, arranque, alertas), sin archivos externos.

## Arquitectura

```
INPUT → INPUT STATE → SIMULATION ENGINE → VEHICLE STATE → UI / AUDIO / FEEDBACK
```

```
src/
├── input/        Dispositivos → InputState (la simulación no sabe qué dispositivo hay)
│   ├── InputDevice.ts        interfaz común + EdgeTracker (isPressed / wasPressed / wasReleased)
│   ├── GamepadInput.ts       Gamepad API, sondeo desde el bucle rAF, reasignación
│   ├── KeyboardInput.ts      pedales progresivos con deltaTime
│   ├── InputManager.ts       selección automática/manual de dispositivo
│   ├── GamepadMapping.ts     asignaciones por defecto (mapeo estándar) y descripciones
│   ├── calibration.ts        normalización, deadzone, smoothing, rampas
│   └── CalibrationWizard.ts  asistente de calibración
├── simulation/   Física pura, sin React ni DOM
│   ├── constants.ts          TODOS los parámetros (curva de par, relaciones, embrague…)
│   ├── enginePhysics.ts      par, pérdidas, ralentí, limitador
│   ├── clutch.ts             pedal → acoplamiento → capacidad; acoplamiento por fricción
│   ├── gearbox.ts            reglas de cambio (secuencial, directo, R)
│   ├── physics.ts            cadena cinemática y resistencias
│   └── engine.ts             SimulationEngine: paso fijo de 2 ms
├── training/     Evaluación de salidas y cambios, asistente, entrenador en vivo,
│                 sesión/métricas, ejercicios, historial
├── audio/        EngineSound (nodos reutilizados), efectos, AudioSystem
├── core/         Simulator: bucle requestAnimationFrame + snapshots para React; ajustes
├── hooks/        useSimulation (useSyncExternalStore), useGamepad, useKeyboard
└── components/   Dashboard, Tachometer, Pedals, GearShift, GearIndicator, GamepadStatus,
                  DrivingAssistant, DebugPanel, SessionSummary, Controller, Settings…
```

La física vive fuera de React: `Simulator` ejecuta el bucle y publica un snapshot inmutable a 30 Hz; los componentes solo lo pintan.

### Modelo físico

- **Motor**: par = curva a plena carga × fracción de mariposa − pérdidas (fricción + bombeo). Un regulador de ralentí mantiene ~800 RPM y el limitador corta a 6.500 RPM.
- **Embrague**: `clutchEngagement = f(clutchPedal)` (0 por encima de ~75 %, progresivo alrededor del punto de fricción al 65 %, 1 por debajo de ~25 %). Su capacidad de par crece con el acoplamiento. El par transmitido se calcula como fricción "implícita": el par que igualaría los giros de motor y caja en el paso, limitado por la capacidad. Si cabe, el embrague queda bloqueado; si no, patina. Es estable con cualquier paso.
- **Transmisión**: par de rueda = par de embrague × relación × grupo; la velocidad sale de F = m·a menos rodadura, aire y freno (que nunca invierten el sentido). En sentido contrario, velocidad → giro de rueda → relación → RPM de la caja.
- **Calado**: si el motor, acoplado y con carga, cae por debajo de 500 RPM. Sale de la física: soltar el embrague de golpe transfiere la inercia del volante al coche y las RPM se hunden.
- **Brusquedad**: la parte del par del embrague que no procede del reparto suave del par motor, en m/s². Es la base de la evaluación de cambios y salidas.

## Tests

`npm test` ejecuta 56 tests: normalización de L2/R2, calibración, deadzone, teclado independiente de los FPS, curva del embrague, reglas de la caja (N→1…5, R solo parado), calado, escenarios completos de conducción (salida, cambios, reducción, frenada con y sin embrague, marcha atrás), evaluaciones, asistente y ejercicios. Incluye la secuencia del criterio de éxito: arrancar → 1ª → salir → 2ª → 3ª → frenar → reducir → parar → N.

## Preparado para el futuro

La palanca H (`GearShift`) y la caja aceptan selección directa de cualquier marcha, así que un modo de palanca con el stick derecho solo tiene que traducir la posición del stick a `selectedGear`. Vehículos distintos, pendientes o motores diésel son cambios en `VehicleConfig` / `constants.ts` y una fuerza adicional en `physics.ts`.
# aprender-a-manejar
