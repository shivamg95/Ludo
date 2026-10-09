import { useAppStore } from './store/gameStore';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { FpsCounter } from './ui/FpsCounter';

export function App() {
  const screen = useAppStore((s) => s.screen);
  const announcement = useAppStore((s) => s.announcement);
  const showFps = useAppStore((s) => s.showFps);

  return (
    <div className="h-full w-full" data-testid="app-root">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {screen === 'setup' && <SetupScreen />}
      {screen === 'game' && <GameScreen />}
      {screen === 'results' && <ResultsScreen />}
      {showFps && <FpsCounter />}
    </div>
  );
}
