import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/sora';
import '@fontsource-variable/space-grotesk';
import './index.css';
import { App } from './App';
import { installTestHook, parseUrlParams, useAppStore } from './store/gameStore';

installTestHook();
document.body.dataset.animIdle = 'true';

const params = parseUrlParams();
if (params.anim === false) {
  document.documentElement.dataset.reducedMotion = 'true';
}

useAppStore.getState().setTheme(useAppStore.getState().theme);

function Root() {
  useEffect(() => {
    const resumed = useAppStore.getState().resumeIfSaved();
    const url = parseUrlParams();
    if (!resumed && url.autoStart) {
      useAppStore.getState().setSetup({
        mode: url.mode ?? 'classic',
        totalPlayers: 2,
        humanCount: 1,
      });
      useAppStore.getState().startGame({
        seed: url.seed ?? 42,
        mode: url.mode ?? 'classic',
      });
      const dice = new URLSearchParams(window.location.search).get('dice');
      if (dice) {
        const queue = dice.split(',').map(Number).filter((n) => n >= 1 && n <= 6);
        useAppStore.getState().dispatch({ type: 'SET_DICE_QUEUE', queue });
      }
      useAppStore.getState().setBotDelay(0);
    }
  }, []);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
