import { ControllerView } from './components/Controller/ControllerView'
import { Dashboard } from './components/Dashboard/Dashboard'
import { ExercisesView } from './components/Exercises/ExercisesView'
import { HistoryView } from './components/History/HistoryView'
import { AppHeader, Notices } from './components/Layout/AppHeader'
import { SettingsView } from './components/Settings/SettingsView'
import { useKeyboard } from './hooks/useKeyboard'
import { useSimulation, useSimulationLoop } from './hooks/useSimulation'

function CurrentView() {
  const { view } = useSimulation()
  switch (view) {
    case 'drive':
      return <Dashboard />
    case 'exercises':
      return <ExercisesView />
    case 'controller':
      return <ControllerView />
    case 'settings':
      return <SettingsView />
    case 'history':
      return <HistoryView />
  }
}

export default function App() {
  useSimulationLoop()
  useKeyboard()
  const { view } = useSimulation()
  return (
    <div className={`app app--${view}`}>
      <AppHeader />
      <main>
        <CurrentView />
      </main>
      <Notices />
    </div>
  )
}
