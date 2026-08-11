import { useAppStore } from './store/gameStore';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { ResultsScreen } from './components/ResultsScreen';

export function App() {
  const screen = useAppStore((s) => s.screen);
  const announcement = useAppStore((s) => s.announcement);

  return (
    <div className="h-full w-full" data-testid="app-root">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {screen === 'setup' && <SetupScreen />}
      {screen === 'game' && <GameScreen />}
      {screen === 'results' && <ResultsScreen />}
    </div>
  );
}
