import { AnimatePresence, motion } from 'motion/react';
import { useAppStore } from './store/gameStore';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { prefersReducedMotion, SCREEN_FADE_S } from './ui/motion';

export function App() {
  const screen = useAppStore((s) => s.screen);
  const announcement = useAppStore((s) => s.announcement);
  const duration = prefersReducedMotion() ? 0 : SCREEN_FADE_S;

  return (
    <div className="h-full w-full" data-testid="app-root">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <AnimatePresence mode="wait">
        {screen === 'setup' && (
          <motion.div
            key="setup"
            className="h-full w-full"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration }}
          >
            <SetupScreen />
          </motion.div>
        )}
        {screen === 'game' && (
          <motion.div
            key="game"
            className="h-full w-full"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration }}
          >
            <GameScreen />
          </motion.div>
        )}
        {screen === 'results' && (
          <motion.div
            key="results"
            className="h-full w-full"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration }}
          >
            <ResultsScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
