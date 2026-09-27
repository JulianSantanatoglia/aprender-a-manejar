# 🚗 SIMULADOR DE CONDUCCIÓN MANUAL

## PRD / Especificación técnica

---

# 1. Objetivo

Crear una aplicación web interactiva para practicar los fundamentos de conducción de un vehículo con **caja de cambios manual**, utilizando principalmente un mando **Sony DualSense de PS5** conectado al ordenador.

La aplicación debe simular de forma simplificada pero coherente:

* Embrague.
* Acelerador.
* Freno.
* RPM.
* Motor.
* Caja manual de 5 velocidades.
* Marcha atrás.
* Punto de fricción del embrague.
* Arranque desde parado.
* Cambios de marcha.
* Reducciones.
* Frenadas.
* Calado del motor.
* Coordinación embrague/acelerador.

El objetivo NO es crear un videojuego.

El objetivo es:

> **Crear una herramienta de entrenamiento que permita practicar la coordinación necesaria para conducir un coche manual.**

Los gráficos son secundarios.

La física, los controles y el feedback educativo son prioritarios.

---

# 2. Stack existente

El proyecto YA está creado con:

* Vite
* React
* TypeScript

No recrear el proyecto.

No migrar de framework.

Mantener la arquitectura existente y construir sobre ella.

Preferencias:

* React
* TypeScript
* CSS moderno / Tailwind si ya está instalado
* Web Gamepad API
* `requestAnimationFrame`
* `localStorage`
* Web Audio API para sonido
* Sin dependencias pesadas innecesarias

---

# 3. Dispositivos de entrada

La aplicación debe soportar DOS sistemas.

## Principal

### DualSense PS5

Utilizar:

```ts
navigator.getGamepads()
```

mediante la Web Gamepad API.

El DualSense debe proporcionar entradas analógicas reales para:

* Embrague.
* Acelerador.

---

## Secundario

### Teclado

El teclado debe funcionar como alternativa para que el simulador también pueda utilizarse sin mando.

El motor de simulación NO debe conocer el dispositivo de entrada.

---

# 4. Arquitectura general

Separar completamente:

```text
INPUT
  ↓
INPUT STATE
  ↓
SIMULATION ENGINE
  ↓
VEHICLE STATE
  ↓
UI / AUDIO / FEEDBACK
```

Arquitectura propuesta:

```text
src/
├── components/
│   ├── Dashboard/
│   ├── Pedals/
│   ├── Tachometer/
│   ├── GearIndicator/
│   ├── GearShift/
│   ├── GamepadStatus/
│   ├── DrivingAssistant/
│   ├── DebugPanel/
│   └── SessionSummary/
│
├── simulation/
│   ├── engine.ts
│   ├── vehicle.ts
│   ├── physics.ts
│   ├── clutch.ts
│   ├── gearbox.ts
│   ├── enginePhysics.ts
│   ├── constants.ts
│   └── types.ts
│
├── input/
│   ├── InputManager.ts
│   ├── InputDevice.ts
│   ├── GamepadInput.ts
│   ├── KeyboardInput.ts
│   ├── GamepadMapping.ts
│   └── types.ts
│
├── audio/
│   ├── engineSound.ts
│   └── effects.ts
│
├── hooks/
│   ├── useSimulation.ts
│   ├── useGamepad.ts
│   └── useKeyboard.ts
│
└── App.tsx
```

No colocar toda la lógica en `App.tsx`.

---

# 5. Input abstraction

Crear una interfaz común:

```ts
interface InputState {
  clutch: number
  accelerator: number
  brake: number

  gearUp: boolean
  gearDown: boolean

  selectedGear: Gear | null

  start: boolean
  pause: boolean
}
```

Todos los dispositivos deben producir este estado.

Por ejemplo:

```text
DualSense
    ↓
InputState

Keyboard
    ↓
InputState
```

La simulación solamente consume:

```ts
InputState
```

---

# 6. DualSense — asignación

Configuración inicial:

| DualSense | Acción                        |
| --------- | ----------------------------- |
| L2        | Embrague                      |
| R2        | Acelerador                    |
| L1        | Freno                         |
| D-Pad ↑   | Cambio de marcha hacia arriba |
| D-Pad ↓   | Cambio de marcha hacia abajo  |
| △         | 5ª / selección especial       |
| ○         | Reversa                       |
| ✕         | Neutral                       |
| OPTIONS   | Pausa                         |
| SHARE     | Reinicio                      |
| ✕         | Arranque cuando corresponda   |

IMPORTANTE:

No asumir que todos los navegadores exponen exactamente el mismo orden de botones.

Crear una capa de mapeo configurable.

---

# 7. DualSense — gatillos analógicos

L2 y R2 son el elemento más importante del proyecto.

El valor recibido debe normalizarse:

```text
0.00 → 0%
1.00 → 100%
```

Ejemplo:

```text
L2 = 0.00
```

significa:

```text
Embrague totalmente liberado
```

Mientras:

```text
L2 = 1.00
```

significa:

```text
Embrague completamente pisado
```

Para R2:

```text
R2 = 0.00
```

→ acelerador sin pulsar.

```text
R2 = 0.50
```

→ 50%.

```text
R2 = 1.00
```

→ acelerador a fondo.

---

# 8. IMPORTANTE — sentido del embrague

En la aplicación:

```text
L2 = 1
```

significa:

```text
embrague totalmente pisado
```

y:

```text
L2 = 0
```

significa:

```text
embrague totalmente suelto.
```

Internamente puede utilizarse:

```ts
clutchPedal = rawL2
clutchEngagement = 1 - rawL2
```

Esto debe quedar claramente separado.

---

# 9. Freno

Por defecto:

```text
L1 = freno
```

L1 será digital:

```text
0 = no pulsado
1 = pulsado
```

Pero diseñar la arquitectura para permitir un freno analógico en el futuro.

---

# 10. Teclado

El teclado será el segundo dispositivo compatible.

Configuración inicial:

```text
A → Embrague
S → Freno
D → Acelerador

Numpad 1 → 1ª
Numpad 2 → 2ª
Numpad 3 → 3ª
Numpad 4 → 4ª
Numpad 5 → 5ª
Numpad 6 → R
Numpad 0 → N

SPACE → Arranque
ESC → Pausa
```

Los pedales del teclado deben simular progresividad.

Mientras la tecla está pulsada:

```text
0%
10%
20%
30%
...
100%
```

Al soltar:

```text
100%
90%
80%
...
0%
```

Utilizar `deltaTime`.

No depender de la velocidad del teclado ni del número de FPS.

---

# 11. Detección del Gamepad

Crear:

```ts
GamepadInput
```

Debe detectar:

```ts
navigator.getGamepads()
```

y escuchar:

```ts
gamepadconnected
gamepaddisconnected
```

Mostrar en la interfaz:

```text
DUALSENSE

● CONECTADO
```

Cuando no haya mando:

```text
○ DUALSENSE NO DETECTADO
```

---

# 12. Pantalla de diagnóstico del mando

Crear una sección:

# 🎮 CONFIGURACIÓN DEL DUALSENSE

Mostrar en tiempo real:

```text
L2 EMBRAGUE
████████░░ 82%

R2 ACELERADOR
████░░░░░░ 41%

L1 FRENO
○

D-PAD
○

△
○

○
○

✕
○
```

Además mostrar:

```text
Gamepad:
DualSense Wireless Controller

Connected:
YES
```

Y:

```text
Axes:
Left X: 0.00
Left Y: 0.00
Right X: 0.00
Right Y: 0.00
```

Esto es principalmente para diagnóstico.

---

# 13. Calibración del DualSense

Crear una pantalla:

# CALIBRACIÓN

Paso 1:

> Suelta todos los botones y gatillos.

Detectar valores mínimos.

Paso 2:

> Pulsa L2 completamente.

Guardar:

```ts
clutchMin
clutchMax
```

Paso 3:

> Pulsa R2 completamente.

Guardar:

```ts
acceleratorMin
acceleratorMax
```

Normalizar:

```ts
normalized = (value - min) / (max - min)
```

Limitar:

```ts
Math.min(1, Math.max(0, normalized))
```

Guardar calibración en `localStorage`.

---

# 14. Deadzone

Aplicar una pequeña deadzone configurable.

Por defecto:

```ts
const DEADZONE = 0.03
```

Para evitar pequeñas lecturas involuntarias.

---

# 15. Suavizado

NO eliminar la naturaleza analógica de los gatillos.

Aplicar solamente un pequeño smoothing opcional:

```ts
smoothed =
  previous + (target - previous) * smoothing
```

Configurable:

```ts
0 → sin smoothing
1 → smoothing máximo
```

Valor inicial recomendado:

```ts
0.15
```

---

# 16. Estado del vehículo

Crear:

```ts
interface VehicleState {
  engineRunning: boolean

  speedKmh: number

  rpm: number

  gear: Gear

  clutchPedal: number
  clutchEngagement: number

  accelerator: number

  brake: number

  stalled: boolean

  distanceMeters: number
}
```

Marchas:

```ts
type Gear =
  | "R"
  | "N"
  | 1
  | 2
  | 3
  | 4
  | 5
```

---

# 17. Estado inicial

Al iniciar:

```text
Motor: ENCENDIDO
RPM: 800
Velocidad: 0 km/h
Marcha: N
Embrague: pisado
Acelerador: 0
Freno: 0
```

---

# 18. Motor

Parámetros iniciales:

```ts
const IDLE_RPM = 800
const REDLINE_RPM = 6500
const MAX_RPM = 7000
```

El motor debe tener una curva de torque simplificada.

Ejemplo:

```text
800 RPM    → 50 Nm
1200 RPM   → 90 Nm
1800 RPM   → 130 Nm
2500 RPM   → 160 Nm
3500 RPM   → 175 Nm
4500 RPM   → 160 Nm
5500 RPM   → 135 Nm
6500 RPM   → 90 Nm
```

Estos valores son orientativos y deben estar centralizados.

---

# 19. Relaciones de transmisión

Utilizar inicialmente:

```ts
const GEAR_RATIOS = {
  R: -3.2,
  1: 3.6,
  2: 2.1,
  3: 1.4,
  4: 1.0,
  5: 0.8
}
```

Final drive:

```ts
const FINAL_DRIVE = 3.4
```

Crear estos valores en:

```text
simulation/constants.ts
```

No hardcodearlos dentro de la física.

---

# 20. Embrague

Este es el corazón del simulador.

El embrague debe transmitir progresivamente el par.

Definir:

```ts
const CLUTCH_BITE_POINT = 0.65
```

Recordar:

```text
clutchPedal = 1
→ pedal totalmente pisado
→ transmisión = 0%

clutchPedal = 0
→ pedal totalmente suelto
→ transmisión = 100%
```

Entre ambos extremos debe existir una zona de acoplamiento progresivo.

---

# 21. Punto de fricción

Cuando el pedal esté cerca del punto de fricción:

```text
aproximadamente 60–75%
```

el coche debe empezar a transmitir fuerza.

Mostrar visualmente:

```text
EMBRAGUE

PISADO
████████████████████

PUNTO DE FRICCIÓN
              ▲

SUELTO
░░░░░░░░░░░░░░░░░░░
```

Durante la conducción:

```text
Punto de fricción
```

debe aparecer como una zona destacada.

---

# 22. Salida desde parado

El usuario debe poder realizar:

```text
1. Embrague completamente pisado
2. Primera marcha
3. Acelerador ~10–25%
4. Liberar embrague lentamente
5. Encontrar punto de fricción
6. Vehículo comienza a avanzar
7. Liberar completamente
```

La aplicación debe detectar la calidad de la salida.

---

# 23. Salida demasiado rápida

Si el usuario:

```text
embrague → 100%
```

a:

```text
embrague → 0%
```

en muy poco tiempo mientras el coche está parado:

el motor debe experimentar una carga brusca.

Si:

```text
RPM < stallThreshold
```

→ calado.

---

# 24. Salida con demasiado acelerador

Si:

```text
accelerator > 0.70
```

durante una salida:

permitir que el coche salga más agresivamente.

Mostrar feedback:

> Salida brusca. Intenta utilizar menos acelerador.

No impedir la acción.

---

# 25. Calado

El motor debe poder calarse.

Condiciones aproximadas:

```text
RPM < 500
+
clutch engagement alto
+
carga elevada
```

Resultado:

```text
engineRunning = false
stalled = true
rpm = 0
speed empieza a disminuir
```

Mostrar:

# ⚠ MOTOR CALADO

Y:

> Pisa el embrague y vuelve a arrancar.

---

# 26. Arranque

Botón:

```text
✕
```

o:

```text
SPACE
```

Condición:

```text
clutchPedal > 0.8
```

o:

```text
gear === "N"
```

Permitir:

```text
embrague + START
```

y arrancar.

RPM:

```text
800
```

---

# 27. Caja de cambios

Debe existir:

```text
R
N
1
2
3
4
5
```

No permitir cambios imposibles.

Ejemplo:

```text
1 → 2
2 → 3
3 → 4
4 → 5
```

Para reducir:

```text
5 → 4
4 → 3
3 → 2
2 → 1
```

---

# 28. Cambiar correctamente

Secuencia:

```text
Acelerar
↓
soltar acelerador
↓
pisar embrague
↓
cambiar marcha
↓
soltar embrague progresivamente
↓
volver a acelerar
```

La simulación debe recompensar esta secuencia mediante un cambio suave.

---

# 29. Cambio sin embrague

Si el usuario intenta cambiar sin embrague:

Mostrar:

> ⚠ Cambio sin embrague.

Dependiendo de las RPM:

* Permitir cambio con penalización.
* Producir cambio brusco.
* Aplicar pérdida temporal de velocidad.
* Generar feedback.

No convertirlo automáticamente en un error fatal.

---

# 30. RPM durante cambios

Durante un cambio:

```text
embrague pisado
```

las RPM pueden caer según el tiempo transcurrido.

Cuando se vuelve a acoplar:

```text
nueva marcha
+
velocidad actual
```

debe determinar la RPM resultante.

Esto debe producir comportamientos realistas:

### Cambio demasiado pronto

RPM demasiado bajas.

### Cambio demasiado tarde

RPM demasiado altas.

### Reducción brusca

RPM pueden subir rápidamente.

---

# 31. Rev matching simplificado

No es necesario implementar un sistema profesional de doble embrague.

Pero sí permitir que el usuario experimente con las RPM.

Ejemplo:

```text
3ª → 2ª
```

Si las RPM de la 2ª deberían ser mayores:

```text
RPM suben
```

Si el usuario suelta el embrague bruscamente:

```text
tirón
```

Si lo hace progresivamente:

```text
cambio suave
```

---

# 32. Freno

L1:

```text
0 = no freno
1 = freno máximo
```

La fuerza de frenado debe ser progresiva.

```text
speed -= brakeForce * brake * deltaTime
```

pero con límites y una física razonable.

---

# 33. Frenar y embrague

Si el vehículo está en una marcha y la velocidad cae demasiado:

```text
RPM ↓
```

Si las RPM llegan a una zona crítica:

```text
⚠ PISA EL EMBRAGUE
```

Esto permitirá aprender cuándo utilizar el embrague durante una parada.

---

# 34. Neutral

Botón:

```text
✕
```

o control configurable.

Neutral:

```text
gear = "N"
```

No transmitir par a las ruedas.

---

# 35. Reverse

Botón:

```text
○
```

para seleccionar:

```text
R
```

Condiciones:

```text
speed ≈ 0
clutchPedal > 0.8
```

Después:

```text
soltar embrague
+
acelerador
```

El vehículo se mueve hacia atrás.

La velocidad puede mostrarse:

```text
-5 km/h
```

---

# 36. Palanca de cambios virtual

Crear una representación visual:

```text
       1     3     5
       │     │     │
       │     │     │
       2     4     R
```

Mostrar la posición actual.

Ejemplo:

```text
       1     3     5
       │     │     │
      [2]    │     │
              │
```

La posición debe cambiar visualmente.

---

# 37. Modo de cambio secuencial

Además del modo de selección directa, crear un modo:

```text
D-PAD ↑ → subir marcha
D-PAD ↓ → bajar marcha
```

Esto facilita inicialmente el control.

Más adelante se puede crear un modo de palanca H más estricto.

---

# 38. Modo H-pattern

Diseñar la arquitectura para permitir posteriormente:

```text
        1    3    5
        │    │    │
        │    │    │
        2    4    R
```

El usuario debería desplazar una palanca virtual utilizando el stick derecho.

Propuesta futura:

```text
Right Stick
```

para mover la palanca.

Pero NO es obligatorio para el MVP.

---

# 39. Asistente de conducción

Crear panel:

# ASISTENTE

Ejemplos:

```text
✓ Motor encendido

✓ Embrague pisado

✓ Primera seleccionada

⚠ Acelera ligeramente

⚠ Libera el embrague progresivamente
```

Debe analizar continuamente el estado.

---

# 40. Feedback inteligente

### Demasiadas RPM

> Estás acelerando demasiado. Para una salida suave, prueba con menos acelerador.

### Embrague demasiado rápido

> Estás soltando el embrague demasiado rápido.

### A punto de calarse

> Las RPM están bajando demasiado. Pasa ligeramente más acelerador o vuelve a pisar el embrague.

### Cambio correcto

> Cambio suave.

### Reducción brusca

> La reducción ha provocado un aumento brusco de RPM. Suelta el embrague más progresivamente.

### Buena salida

> Buena coordinación entre embrague y acelerador.

---

# 41. Modo práctica libre

Crear:

# PRÁCTICA LIBRE

Sin límite de tiempo.

El usuario puede practicar:

* salidas
* cambios
* reducciones
* frenadas
* marcha atrás

---

# 42. Modo ejercicios

Crear sistema de ejercicios.

## Ejercicio 1

### Salida desde parado

Objetivo:

```text
0 → 20 km/h
```

sin calar.

---

## Ejercicio 2

### 1ª → 2ª

Realizar un cambio suave.

---

## Ejercicio 3

### 2ª → 3ª

---

## Ejercicio 4

### 3ª → 2ª

Practicar reducción.

---

## Ejercicio 5

### Frenar y detenerse

---

## Ejercicio 6

### Marcha atrás

---

# 43. Métricas

Registrar:

```text
Calados
Cambios correctos
Cambios bruscos
Frenadas bruscas
RPM máxima
Velocidad máxima
Tiempo
```

No utilizar una puntuación arcade.

Mostrar métricas educativas:

```text
CONTROL DEL EMBRAGUE
████████░░ 84%

CONTROL DE RPM
█████████░ 91%

SUAVIDAD
███████░░░ 73%
```

---

# 44. Historial

Guardar sesiones en:

```text
localStorage
```

Ejemplo:

```text
27/09/2026
Duración: 08:32
Calados: 1
Cambios correctos: 12
Cambios bruscos: 2
```

---

# 45. Tacómetro

Crear un tacómetro grande.

Mostrar:

```text
0     1     2     3     4     5     6     7
      RPM ×1000
```

La aguja debe responder en tiempo real.

Marcar:

```text
Idle
Zona útil
Zona alta
Redline
```

---

# 46. Velocidad

Mostrar:

```text
0 km/h
```

grande.

Actualizar suavemente.

---

# 47. Marcha actual

Mostrar de forma muy grande:

```text
1
```

o:

```text
2
```

etc.

Neutral:

```text
N
```

Reverse:

```text
R
```

---

# 48. Pedales

Mostrar:

```text
EMBRAGUE
████████░░ 80%

FRENO
██░░░░░░░░ 20%

ACELERADOR
████░░░░░░ 40%
```

Estos indicadores deben representar exactamente el estado de `InputState`.

---

# 49. Indicador de punto de fricción

Cuando el embrague se encuentre cerca de la zona de fricción:

mostrar:

```text
🔥 PUNTO DE FRICCIÓN
```

y una indicación visual.

Esto debe ser especialmente útil durante el entrenamiento inicial.

---

# 50. Audio

Utilizar Web Audio API inicialmente.

Sonidos:

* motor
* aceleración
* RPM alta
* cambio
* calado
* frenada
* alerta

El tono del motor debe cambiar según RPM.

Por ejemplo:

```text
RPM baja → sonido grave
RPM alta → sonido agudo
```

No es necesario utilizar archivos de audio externos para el MVP.

---

# 51. Motor de sonido

Crear:

```text
audio/engineSound.ts
```

El sonido debe actualizarse aproximadamente según:

```text
rpm / redline
```

No crear un sonido nuevo en cada frame.

Crear y reutilizar nodos de audio.

---

# 52. Game Loop

Utilizar:

```ts
requestAnimationFrame
```

con `deltaTime`.

Conceptualmente:

```ts
function update(deltaTime: number) {
  input = inputManager.getState()

  updatePedals(input, deltaTime)

  updateClutch(vehicle, input, deltaTime)

  updateGearbox(vehicle, input)

  updateEngine(vehicle, deltaTime)

  updatePhysics(vehicle, deltaTime)

  updateAudio(vehicle)
}
```

La simulación no debe depender del FPS.

---

# 53. Simulación independiente de React

MUY IMPORTANTE.

No ejecutar toda la física mediante `useState` en cada frame.

Mantener el estado de simulación en un motor independiente.

React debe recibir snapshots/updates necesarios para renderizar.

Esto evita:

```text
60 renders por segundo innecesarios
```

---

# 54. Pausa

OPTIONS:

```text
PAUSA
```

Mostrar:

```text
SIMULACIÓN PAUSADA

Continuar
Reiniciar
Configuración
Salir
```

---

# 55. Reinicio

SHARE:

```text
REINICIAR
```

Estado:

```text
engineRunning = true
rpm = 800
speed = 0
gear = N
clutchPedal = 1
accelerator = 0
brake = 0
stalled = false
```

---

# 56. Configuración

Crear:

# CONFIGURACIÓN

## Dispositivo

```text
● DualSense
○ Teclado
```

## Controles

Permitir reasignar:

```text
Embrague
Acelerador
Freno
Subir marcha
Bajar marcha
Neutral
Reverse
Start
Pause
Restart
```

---

# 57. Configuración de sensibilidad

Controles:

```text
Deadzone embrague
Deadzone acelerador

Smoothing embrague
Smoothing acelerador
```

Sliders:

```text
Deadzone
0% ─────●──── 10%

Smoothing
0% ──●──────── 100%
```

---

# 58. Configuración del vehículo

Crear una sección avanzada:

```text
RPM ralentí
RPM máxima
Potencia
Masa
Fuerza de frenado
Resistencia
Punto de fricción
Respuesta del acelerador
Respuesta del embrague
```

Inicialmente puede estar oculta bajo:

```text
Configuración avanzada
```

---

# 59. Debug mode

Crear:

```text
DEBUG MODE
```

Mostrar:

```text
INPUT

Clutch:      0.72
Accelerator: 0.34
Brake:       0

VEHICLE

Speed:       12.4
RPM:         1840
Gear:        1

CLUTCH

Pedal:       0.72
Engagement:  0.31

ENGINE

Torque:      132 Nm
```

Esto será fundamental durante el desarrollo.

---

# 60. Tests

Crear tests para:

### Input

```text
L2 0 → clutch 0
L2 1 → clutch 1

R2 0 → accelerator 0
R2 1 → accelerator 1
```

### Calibración

```text
min/max
normalization
deadzone
```

### Clutch

```text
pedal pressed
pedal released
bite point
```

### Gearbox

```text
N → 1
1 → 2
2 → 3
3 → 4
4 → 5
```

### Reverse

```text
N → R
```

solo cuando sea seguro.

### Stall

```text
low RPM
+
high clutch engagement
+
vehicle load
=
stall
```

---

# 61. Compatibilidad

La aplicación debe funcionar con:

* Chrome
* Edge
* Firefox si la Gamepad API proporciona los datos necesarios

Priorizar Chrome/Edge para el desarrollo inicial.

Si el navegador no detecta el DualSense:

mostrar:

```text
No se ha detectado ningún mando.

Conecta el DualSense mediante USB-C y pulsa cualquier botón.
```

---

# 62. USB primero

Durante desarrollo utilizar preferentemente:

```text
DualSense → USB-C → PC
```

Después comprobar:

```text
DualSense → Bluetooth → PC
```

La aplicación no debe diferenciar ambos métodos.

---

# 63. No utilizar librerías innecesarias

No instalar:

```text
Three.js
Babylon
Unity
Phaser
React Three Fiber
```

para este MVP.

No necesitamos gráficos 3D.

La aplicación debe centrarse en la simulación.

---

# 64. Diseño visual

Estética:

* Dark mode.
* Minimalista.
* Moderna.
* Técnica.
* Muy legible.
* Paneles tipo dashboard.
* Grandes indicadores.
* Animaciones suaves.

No hacer una interfaz de videojuego infantil.

Debe parecer:

> **software de entrenamiento de conducción.**

---

# 65. Layout

Desktop:

```text
┌─────────────────────────────────────────────────────┐
│                 SIMULADOR MANUAL                    │
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│      TACÓMETRO           │       ASISTENTE          │
│                          │                          │
│        2.300 RPM         │  ✓ Primera              │
│                          │  ✓ Embrague             │
│                          │  ⚠ Acelera suavemente   │
│                          │                          │
├──────────────────────────┼──────────────────────────┤
│                          │                          │
│       VELOCIDAD          │      PEDALES             │
│                          │                          │
│         23 km/h          │ EMBRAGUE ███████░       │
│                          │ FRENO    ░░░░░░░░       │
│         MARCHA 2         │ ACEL.    ████░░░░       │
│                          │                          │
├──────────────────────────┴──────────────────────────┤
│               PALANCA DE CAMBIOS                   │
│                                                     │
│                1   3   5                            │
│                2   4   R                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

# 66. UX del DualSense

Cuando el usuario conecta el mando:

Mostrar:

```text
🎮 DualSense conectado
```

Si lo desconecta:

```text
⚠ DualSense desconectado
Cambiando a teclado.
```

Si vuelve a conectarlo:

```text
✓ DualSense conectado
```

No detener la aplicación.

---

# 67. Cambio automático de dispositivo

Si existe DualSense:

```text
Input = Gamepad
```

Si no:

```text
Input = Keyboard
```

Permitir cambiar manualmente.

---

# 68. InputManager

Crear:

```ts
class InputManager {
  private activeDevice: InputDevice

  getState(): InputState

  setDevice(device: InputDevice): void
}
```

Dispositivos:

```ts
KeyboardInput
GamepadInput
```

---

# 69. Gamepad polling

La Gamepad API puede requerir polling.

Implementar correctamente:

```ts
requestAnimationFrame
```

o integrarlo con el loop principal.

No crear intervalos innecesarios.

---

# 70. Detección de botón pulsado una sola vez

Diferenciar:

```text
button pressed
```

de:

```text
button held
```

Necesario para:

* cambio de marcha
* start
* pause
* restart

Crear helper:

```ts
isPressed()
wasPressed()
wasReleased()
```

---

# 71. Marchas y eventos

Un cambio de marcha debe ser un evento:

```ts
GearChangeEvent
```

Ejemplo:

```ts
{
  from: 1,
  to: 2,
  clutch: 0.92,
  speed: 18.4,
  rpm: 2300
}
```

Esto permitirá analizar posteriormente la calidad del cambio.

---

# 72. Evaluación del cambio

Después de cada cambio:

calcular:

```text
RPM antes
RPM después
tiempo de embrague
brusquedad
pérdida de velocidad
```

Clasificar internamente:

```text
smooth
acceptable
rough
bad
```

No mostrar necesariamente la clasificación técnica al usuario.

Mostrar:

> Cambio suave.

o:

> Cambio brusco. Intenta liberar el embrague más progresivamente.

---

# 73. Evaluación de la salida

Registrar:

```text
Tiempo hasta movimiento
RPM máxima
RPM mínima
Tiempo en punto de fricción
Acelerador medio
```

Mostrar:

> Salida correcta.

o:

> Has soltado demasiado rápido el embrague.

---

# 74. Sesión de entrenamiento

Crear:

```ts
DrivingSession
```

con:

```ts
startTime
duration
stalls
gearChanges
smoothChanges
roughChanges
hardBrakes
maxSpeed
maxRPM
```

---

# 75. Objetivo principal de aprendizaje

El sistema debe enseñar indirectamente:

```text
EMBRAGUE
    +
ACELERADOR
    +
RPM
    +
MARCHA
    =
MOVIMIENTO
```

La persona debe poder experimentar con diferentes combinaciones y comprender qué sucede.

---

# 76. Importante: no crear una física falsa demasiado arcade

Evitar:

```ts
speed += accelerator * 10
```

sin relación con el resto.

La velocidad debe surgir de:

```text
Torque del motor
×
Relación de marcha
×
Relación final
×
Engagement del embrague
-
Resistencia
-
Freno
```

La física puede ser simplificada, pero debe ser coherente.

---

# 77. Modelo físico simplificado

Flujo:

```text
RPM
 ↓
Torque curve
 ↓
Engine torque
 ↓
Clutch engagement
 ↓
Gear ratio
 ↓
Final drive
 ↓
Wheel torque
 ↓
Driving force
 ↓
Vehicle acceleration
 ↓
Speed
```

Y:

```text
Speed
 ↓
Wheel RPM
 ↓
Transmission ratio
 ↓
Clutch
 ↓
Engine RPM
```

Esto permite que las RPM y la velocidad estén relacionadas correctamente.

---

# 78. Ralentí

Cuando el motor está encendido y no hay carga:

```text
RPM → 800
```

No permitir:

```text
RPM = 0
```

salvo que el motor esté calado.

---

# 79. Limitador

Si:

```text
RPM >= 6500
```

activar limitador.

Mostrar:

```text
⚠ REDLINE
```

Reducir la entrega de potencia.

No permitir RPM infinitas.

---

# 80. Resistencia

Aplicar resistencia:

```text
rolling resistance
+
air resistance
```

simplificada.

Esto permite que el vehículo disminuya velocidad naturalmente al soltar el acelerador.

---

# 81. Parada

Cuando:

```text
speed < 1 km/h
```

permitir:

```text
0
```

sin problemas numéricos.

---

# 82. Estado de motor calado

Cuando el motor está calado:

```text
RPM = 0
Torque = 0
```

El vehículo puede continuar desplazándose brevemente por inercia si ya estaba en movimiento.

---

# 83. Reinicio después de calado

Para arrancar:

```text
pisar embrague
+
N o embrague suficiente
+
START
```

---

# 84. Primera versión funcional

Antes de añadir ejercicios, estadísticas o audio, conseguir exactamente esto:

```text
DUALSENSE
   ↓
L2 embrague
R2 acelerador
L1 freno
   ↓
MOTOR
   ↓
EMBRAGUE
   ↓
CAJA
   ↓
RUEDAS
   ↓
VELOCIDAD
```

Y poder:

```text
Arrancar
↓
1ª
↓
Salir
↓
Acelerar
↓
2ª
↓
3ª
↓
Frenar
↓
Reducir
↓
Parar
↓
N
```

sin inconsistencias.

---

# 85. Fases de desarrollo

## FASE 1 — INPUT

Implementar:

* Gamepad API.
* Detección DualSense.
* L2.
* R2.
* L1.
* D-pad.
* Botones.
* Keyboard fallback.
* Calibración.
* Deadzone.

---

## FASE 2 — VEHÍCULO

Implementar:

* Motor.
* RPM.
* Torque.
* Embrague.
* Caja.
* Velocidad.
* Frenos.
* Resistencia.

---

## FASE 3 — CONDUCCIÓN

Implementar:

* Salida.
* Cambios.
* Reducciones.
* Reverse.
* Calado.
* Arranque.

---

## FASE 4 — UI

Implementar:

* Tacómetro.
* Velocidad.
* Marcha.
* Pedales.
* Palanca.
* Asistente.

---

## FASE 5 — AUDIO

Implementar:

* Motor.
* RPM.
* Cambio.
* Calado.
* Alertas.

---

## FASE 6 — ENTRENAMIENTO

Implementar:

* Ejercicios.
* Métricas.
* Historial.
* Evaluación.

---

# 86. Criterio de éxito

El proyecto se considera funcional cuando pueda conectar el DualSense mediante USB y realizar:

```text
1. Conectar DualSense
2. Abrir aplicación
3. Detectar mando automáticamente
4. Calibrar L2/R2
5. Arrancar motor
6. Pisar L2
7. Seleccionar primera
8. Pulsar R2 aproximadamente 15–25%
9. Liberar L2 progresivamente
10. Encontrar punto de fricción
11. Comenzar a avanzar
12. Acelerar
13. Soltar R2
14. Pisar L2
15. Cambiar a segunda
16. Liberar L2
17. Acelerar
18. Cambiar a tercera
19. Frenar
20. Reducir
21. Detener
22. Seleccionar neutral
```

La aplicación debe reaccionar de forma coherente a cada acción.

---

# 87. Regla fundamental de desarrollo

NO intentar hacer un videojuego.

NO añadir gráficos 3D innecesarios.

NO utilizar motores externos.

NO introducir dependencias sin necesidad.

La prioridad es:

```text
1. INPUT ANALÓGICO
2. FÍSICA COHERENTE
3. EMBRAGUE
4. RPM
5. CAMBIOS
6. FEEDBACK
7. AUDIO
8. ESTÉTICA
```

El resultado final debe sentirse como:

> **Una herramienta de práctica para aprender a conducir un coche manual utilizando un DualSense como conjunto de controles de conducción.**

---

# 88. Futuras extensiones

La arquitectura debe permitir posteriormente:

* Palanca H virtual mediante joystick.
* Pendientes.
* Diferentes vehículos.
* Diferentes motores.
* Diesel / gasolina.
* Diferentes puntos de embrague.
* Semáforos.
* Intersecciones.
* Tráfico.
* Circuitos.
* Conducción urbana.
* Aparcamiento.
* Examen de conducción.
* Situaciones de autoescuela.
* Modo instructor.
* Perfiles de usuario.
* Estadísticas avanzadas.

NO implementar estas funciones ahora.

La arquitectura debe simplemente permitir incorporarlas posteriormente.

---

# 89. INSTRUCCIÓN FINAL PARA CLAUDE/CURSOR

Construye el proyecto por fases.

Antes de implementar una fase posterior, comprobar que la anterior funciona.

No generar código monolítico.

No colocar lógica compleja en componentes React.

Crear tipos claros.

Crear constantes centralizadas.

Mantener la simulación desacoplada de la interfaz.

Utilizar TypeScript correctamente.

Evitar `any` salvo que sea estrictamente necesario para una API externa y documentarlo.

No instalar librerías innecesarias.

Si existe una decisión entre una implementación compleja y una implementación sencilla que permita conseguir el mismo objetivo, elegir la sencilla.

Pero NO simplificar la lógica fundamental del:

```text
embrague
+
motor
+
RPM
+
caja
+
velocidad
```

porque esa es la parte educativa principal del proyecto.

Al finalizar cada fase, dejar la aplicación ejecutable y funcional.

## Primera tarea

Antes de implementar toda la aplicación:

1. Inspeccionar el proyecto actual.
2. Identificar la estructura existente.
3. Comprobar dependencias.
4. Implementar `InputDevice`.
5. Implementar `GamepadInput`.
6. Detectar el DualSense.
7. Mostrar L2/R2/L1 en tiempo real.
8. Implementar la pantalla de diagnóstico.
9. Implementar teclado como fallback.
10. Verificar que los valores analógicos de L2/R2 funcionan correctamente.
11. Solo después comenzar con el motor de simulación.

No avanzar al motor de física hasta comprobar que el DualSense está siendo detectado correctamente y que:

```text
L2 → 0.00–1.00
R2 → 0.00–1.00
```

funcionan en tiempo real.
