import { classicHooks } from './classic';
import { timedHooks } from './timed';
import { quickHooks } from './quick';
import type { ModeHooks } from './types';
import type { GameMode } from '../types';

export function getModeHooks(mode: GameMode): ModeHooks {
  switch (mode) {
    case 'classic':
      return classicHooks;
    case 'timed':
      return timedHooks;
    case 'quick':
      return quickHooks;
  }
}

export type { ModeHooks };
export { classicHooks, timedHooks, quickHooks };
